const { spawnSync } = require("node:child_process");
const path = require("node:path");

const isWindows = process.platform === "win32";
const result = spawnSync(
  isWindows ? "powershell.exe" : "bash",
  isWindows
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "start-api-windows.ps1"), ...process.argv.slice(2)]
    : [path.join(__dirname, "start-api.sh"), ...process.argv.slice(2)],
  { cwd: path.resolve(__dirname, ".."), stdio: "inherit", windowsHide: true },
);

if (result.error) console.error(`[api] ${result.error.message}`);
process.exitCode = result.error ? 1 : result.status ?? 130;
