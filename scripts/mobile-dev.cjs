const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const mobileRoot = path.join(projectRoot, "apps", "mobile");
const expoCli = path.join(projectRoot, "node_modules", "expo", "bin", "cli");
const [mode, ...extraArgs] = process.argv.slice(2);
const isWindows = process.platform === "win32";
const helpRequested = extraArgs.includes("--help") || extraArgs.includes("-h");
const adbOptions = { encoding: "utf8", timeout: 10_000, windowsHide: true };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: mobileRoot,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) {
    console.error(`[mobile] Could not launch ${command}: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 130;
  }
}

function connectWindowsDevices() {
  const devices = spawnSync("adb.exe", ["devices"], adbOptions);
  if (devices.error || devices.status !== 0) {
    console.error("[mobile] Could not run adb. Add Android SDK platform-tools to PATH.");
    throw new Error("Android SDK platform-tools must be available on PATH.");
  }
  const connectedIds = devices.stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(\S+)\s+device$/);
    return match ? [match[1]] : [];
  });
  if (connectedIds.length === 0) {
    console.error("[mobile] Start the Android emulator, then run npm run android.");
    return [];
  }
  for (const deviceId of connectedIds) {
    for (const port of [3000, 8081]) {
      const forwarded = spawnSync(
        "adb.exe", ["-s", deviceId, "reverse", `tcp:${port}`, `tcp:${port}`], adbOptions,
      );
      if (forwarded.error || forwarded.status !== 0) {
        console.error(`[mobile] Could not forward port ${port} for ${deviceId}.`);
        throw new Error(`ADB port forwarding failed for ${deviceId}. Reconnect the emulator and try again.`);
      }
    }
  }
  return connectedIds;
}

async function checkApi(apiUrl) {
  const origin = new URL(apiUrl).origin;
  let health;
  try {
    const response = await fetch(`${origin}/api/health`, {
      signal: AbortSignal.timeout(30_000),
    });
    health = await response.json();
    if (!response.ok || health.status !== "ok" || health.db !== "connected") {
      throw new Error("Database unavailable");
    }
  } catch {
    throw new Error(`API/database is unavailable at ${origin}. Run npm run dev:api in a separate terminal and wait for it to be ready, then retry.`);
  }
  if (health.auth !== "configured") {
    throw new Error("Backend authentication is not configured. Check the Google/Better Auth settings in apps/web/.env.local.");
  }
  console.log(`[mobile] API ready at ${origin}; database connected; authentication configured.`);
}

function openWindowsDebugApp(deviceIds) {
  if (deviceIds.length !== 1) {
    throw new Error("Keep one Android device/emulator connected when using npm run android:open.");
  }
  const deviceId = deviceIds[0];
  const appId = require(path.join(mobileRoot, "app.json")).expo.android.package;
  const installed = spawnSync("adb.exe", ["-s", deviceId, "shell", "dumpsys", "package", appId], adbOptions);
  if (installed.error || installed.status !== 0 || !/\bDEBUGGABLE\b/.test(installed.stdout)) {
    throw new Error("The Kak Fit debug app is not installed. Run npm run android once to build/install it, then use npm run android:open.");
  }
  const opened = spawnSync("adb.exe", [
    "-s", deviceId, "shell", "am", "start", "-W",
    "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER",
    "-n", `${appId}/.MainActivity`,
  ], adbOptions);
  if (opened.error || opened.status !== 0 || !/Status: ok/.test(opened.stdout)) {
    throw new Error("Could not open Kak Fit. Unlock the emulator, then retry npm run android:open.");
  }
  console.log(`[mobile] Opened Kak Fit debug app on ${deviceId}. Keep the API and Metro terminals running; saved UI changes use Fast Refresh.`);
}

async function metroIsRunning() {
  try {
    const response = await fetch("http://127.0.0.1:8081/status", {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok && (await response.text()).trim() === "packager-status:running";
  } catch { }
  return false;
}

async function checkMetroProject() {
  const response = await fetch("http://127.0.0.1:8081/?platform=android", {
    headers: { Accept: "application/json", "expo-platform": "android" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Metro is still starting. Wait, then run the command again.");
  const manifest = await response.json();
  const directory = manifest.extra?.expoGo?.developer?.projectRoot;
  if (!directory || path.resolve(directory).toLowerCase() !== mobileRoot.toLowerCase()) {
    throw new Error("Port 8081 belongs to a different project. Stop that server, then run npm start for Kak Fit.");
  }
}

function windowsAndroidArgs() {
  const args = [];
  for (let index = 0; index < extraArgs.length; index++) {
    const arg = extraArgs[index];
    if (arg === "--port" || arg === "-p" || arg.startsWith("--port=")) {
      const port = arg.startsWith("--port=") ? arg.slice(7) : extraArgs[++index];
      if (port !== "8081") throw new Error("This Windows emulator workflow uses Metro on port 8081.");
    } else {
      args.push(arg);
    }
  }
  if (!args.includes("--no-bundler")) args.push("--no-bundler");
  return args;
}

async function main() {
  if (mode !== "start" && mode !== "android" && mode !== "open") {
    console.error("Usage: node scripts/mobile-dev.cjs <start|android|open> [Expo options]");
    process.exitCode = 1;
  } else if (mode === "open" && helpRequested) {
    console.log("Usage: npm run android:open\nReopen the installed Windows emulator debug app without rebuilding. Start npm run dev:api and npm start first.");
  } else if (mode === "open" && !isWindows) {
    throw new Error("android:open supports the Windows emulator workflow. Use npm run android on this platform.");
  } else if (!isWindows && mode === "start" && !helpRequested) {
    // Preserve the existing LAN/IP and Linux watcher setup.
    run("bash", [path.join(__dirname, "start-expo.sh"), ...extraArgs]);
  } else {
    const env = { ...process.env };
    if (isWindows) {
      env.EXPO_PUBLIC_API_URL ||= "http://localhost:3000";
      env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";
      env.REACT_NATIVE_PACKAGER_HOSTNAME = "127.0.0.1";
      env.NODE_ENV = "development";
    }
    const deviceIds = isWindows && !helpRequested ? connectWindowsDevices() : [];
    if (mode === "start" || !isWindows || helpRequested || deviceIds.length > 0) {
      // Expo's existing-port detection uses Unix lsof, which is unavailable on
      // Windows. Skip it explicitly so the debug build cannot drift to port 8082.
      if (isWindows && !helpRequested) {
        await checkApi(env.EXPO_PUBLIC_API_URL);
        const metroReady = await metroIsRunning();
        if (metroReady) {
          await checkMetroProject();
          if (mode === "start") {
            console.log("[mobile] Kak Fit Metro is already running on 8081. Keep it open and run npm run android in the other terminal.");
            return;
          }
        } else if (mode !== "start") {
          throw new Error("Start npm start in a separate terminal and wait for Metro on port 8081, then retry this command.");
        }
      }
      if (mode === "open") {
        openWindowsDebugApp(deviceIds);
        return;
      }
      const args = mode === "start"
        ? ["start", "--localhost", "--port", "8081", ...extraArgs]
        : ["run:android", ...(isWindows && !helpRequested ? windowsAndroidArgs() : extraArgs)];
      run(process.execPath, [expoCli, ...args], { env });
    } else {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(`[mobile] ${error.message}`);
  process.exitCode = 1;
});
