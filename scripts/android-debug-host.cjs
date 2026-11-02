const { spawnSync } = require("node:child_process");

/** Configure RN's standard developer-menu host preference for ADB reverse. */
function configureDebugHost(deviceId, appId, restart) {
  if (!/^[a-zA-Z0-9_.]+$/.test(appId)) throw new Error("Invalid Android application ID.");
  const options = { encoding: "utf8", timeout: 10_000, windowsHide: true };
  const adb = (args, extra = {}) => spawnSync("adb.exe", ["-s", deviceId, ...args], { ...options, ...extra });
  const preferencesPath = `shared_prefs/${appId}_preferences.xml`;
  const read = adb(["shell", "run-as", appId, "cat", preferencesPath]);
  if (read.error || (read.status !== 0 && !read.stderr.includes("No such file or directory"))) {
    throw new Error("Could not read the debug app's Metro settings. Verify that its debug build is installed.");
  }
  const original = read.status === 0 ? read.stdout : '<?xml version="1.0" encoding="utf-8"?>\n<map>\n</map>\n';
  const hostEntry = /<string name="debug_http_host">[\s\S]*?<\/string>/;
  const desiredEntry = '<string name="debug_http_host">127.0.0.1:8081</string>';
  const needsUpdate = !original.includes(desiredEntry);
  let updated = original;
  if (needsUpdate) {
    if (hostEntry.test(original)) updated = original.replace(hostEntry, desiredEntry);
    else if (original.includes("</map>")) updated = original.replace("</map>", `    ${desiredEntry}\n</map>`);
    else if (/<map\s*\/>/.test(original)) updated = original.replace(/<map\s*\/>/, `<map>\n    ${desiredEntry}\n</map>`);
    else throw new Error("Unrecognized debug preferences; refusing to overwrite them.");
  }
  if (restart || needsUpdate) {
    const stopped = adb(["shell", "am", "force-stop", appId]);
    if (stopped.error || stopped.status !== 0) throw new Error("Could not restart the debug app.");
  }
  if (needsUpdate) {
    // Only the validated package/path is interpolated; XML travels on stdin.
    // Preserve all other preferences and replace the file atomically while stopped.
    const write = adb(["shell", `run-as ${appId} sh -c 'mkdir -p shared_prefs && cat > ${preferencesPath}.tmp && mv ${preferencesPath}.tmp ${preferencesPath}'`], { input: updated });
    if (write.error || write.status !== 0) throw new Error("Could not set Metro's localhost connection for the debug app.");
    const verified = adb(["shell", "run-as", appId, "cat", preferencesPath]);
    if (verified.error || verified.status !== 0 || !verified.stdout.includes(desiredEntry)) {
      throw new Error("Metro host configuration did not persist. Retry npm run android.");
    }
    console.log("[mobile] Metro host set to 127.0.0.1:8081 through ADB reverse.");
  }
}

module.exports = { configureDebugHost };
