const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const mobileRoot = path.join(projectRoot, "apps", "mobile");
const expoCli = path.join(projectRoot, "node_modules", "expo", "bin", "cli");
const [mode, ...extraArgs] = process.argv.slice(2);
const isWindows = process.platform === "win32";
const helpRequested = extraArgs.includes("--help") || extraArgs.includes("-h");

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
  const options = { encoding: "utf8", timeout: 10_000, windowsHide: true };
  const devices = spawnSync("adb.exe", ["devices"], options);
  if (devices.error || devices.status !== 0) {
    console.error("[mobile] Could not run adb. Add Android SDK platform-tools to PATH.");
    return false;
  }
  const connectedIds = devices.stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(\S+)\s+device$/);
    return match ? [match[1]] : [];
  });
  if (connectedIds.length === 0) {
    console.error("[mobile] Start the Android emulator, then run npm run android.");
    return false;
  }
  for (const deviceId of connectedIds) {
    for (const port of [3000, 8081]) {
      const forwarded = spawnSync(
        "adb.exe", ["-s", deviceId, "reverse", `tcp:${port}`, `tcp:${port}`], options,
      );
      if (forwarded.error || forwarded.status !== 0) {
        console.error(`[mobile] Could not forward port ${port} for ${deviceId}.`);
        return false;
      }
    }
  }
  return true;
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
  if (mode !== "start" && mode !== "android") {
    console.error("Usage: node scripts/mobile-dev.cjs <start|android> [Expo options]");
    process.exitCode = 1;
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
    const connected = !isWindows || helpRequested || connectWindowsDevices();
    if (mode === "start" || connected) {
      // Expo's existing-port detection uses Unix lsof, which is unavailable on
      // Windows. Skip it explicitly so the debug build cannot drift to port 8082.
      if (isWindows && !helpRequested) {
        const metroReady = await metroIsRunning();
        if (metroReady) {
          await checkMetroProject();
          if (mode === "start") {
            console.log("[mobile] Kak Fit Metro is already running on 8081. Keep it open and run npm run android in the other terminal.");
            return;
          }
        } else if (mode === "android") {
          throw new Error("Start npm start in Terminal 1 and wait for Metro on port 8081, then run npm run android in Terminal 2.");
        }
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
