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
    const args = mode === "start"
      ? ["start", "--localhost", "--port", "8081", ...extraArgs]
      : ["run:android", ...extraArgs];
    // Expo reuses Metro on port 8081 when npm start is already running.
    run(process.execPath, [expoCli, ...args], { env });
  } else {
    process.exitCode = 1;
  }
}
