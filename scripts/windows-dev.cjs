const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

function portIsInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (inUse) => { socket.destroy(); resolve(inUse); };
    socket.setTimeout(2_000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

/** Own only processes started by this invocation; never stop reused services. */
async function startWindowsDev({ env, mobileRoot, expoCli, extraArgs, checkApi, metroIsRunning, checkMetroProject }) {
  const children = [];
  const shutdown = new AbortController();
  const interrupted = new Error("Development stopped");
  let stopping = false;
  let fail;
  const failed = new Promise((_, reject) => { fail = reject; });
  // A child can fail while a different startup step is in progress.
  failed.catch(() => {});
  const guard = (operation) => Promise.race([operation, failed]);
  const onSignal = () => {
    stopping = true;
    shutdown.abort(interrupted);
    fail(interrupted);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  function launch(name, args, cwd, stdin = "ignore") {
    const child = spawn(process.execPath, args, {
      cwd, env, stdio: [stdin, "inherit", "inherit"], windowsHide: true,
    });
    children.push(child);
    child.once("error", (error) => fail(new Error(`${name} could not start: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (!stopping) fail(new Error(`${name} stopped (${signal ?? code}). Run npm start again.`));
    });
    return child;
  }

  try {
    const apiUrl = new URL(env.EXPO_PUBLIC_API_URL);
    const localApi = ["localhost", "127.0.0.1"].includes(apiUrl.hostname)
      && apiUrl.protocol === "http:" && apiUrl.port === "3000";
    if (localApi && !(await guard(portIsInUse(3000)))) {
      const projectRoot = path.resolve(mobileRoot, "../..");
      console.log("[mobile] Starting the local API on port 3000...");
      launch("API", [
        path.join(projectRoot, "node_modules/next/dist/bin/next"),
        "dev", "--hostname", "127.0.0.1", "--port", "3000",
      ], path.join(projectRoot, "apps/web"));
      const deadline = Date.now() + 90_000;
      while (true) {
        try {
          await guard(checkApi(apiUrl.origin, 5_000));
          break;
        } catch (error) {
          if (shutdown.signal.aborted || Date.now() >= deadline || /authentication is not configured/.test(error.message)) throw error;
          await guard(delay(500, undefined, { signal: shutdown.signal }));
        }
      }
    } else {
      await guard(checkApi(apiUrl.origin));
      console.log("[mobile] Reusing the API. Keep its existing terminal open.");
    }

    // Compile the API router before the app's first request, and verify that
    // port 3000 really serves Kak Fit rather than an unrelated local server.
    if (localApi) {
      const response = await guard(fetch(`${apiUrl.origin}/api/trpc/health`, {
        signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(30_000)]),
      }));
      const result = await guard(response.json());
      if (!response.ok || result.result?.data?.json?.service !== "kak-fit-api") {
        throw new Error(`Kak Fit API router is unavailable on port 3000 (HTTP ${response.status}); inspect its terminal before opening Android.`);
      }
    }

    if (await guard(metroIsRunning())) {
      console.log("[mobile] Reusing Kak Fit Metro on 8081. Keep its existing terminal open.");
    } else {
      launch("Metro", [expoCli, "start", "--localhost", "--port", "8081", ...extraArgs], mobileRoot, "inherit");
      const deadline = Date.now() + 90_000;
      while (!(await guard(metroIsRunning()))) {
        if (Date.now() >= deadline) throw new Error("Metro did not become ready on port 8081. Inspect the startup logs.");
        await guard(delay(500, undefined, { signal: shutdown.signal }));
      }
    }
    const manifest = await guard(checkMetroProject());
    const bundleUrl = new URL(manifest.launchAsset?.url);
    if (!["localhost", "127.0.0.1"].includes(bundleUrl.hostname) || bundleUrl.port !== "8081") {
      throw new Error("Metro advertised an unexpected Android bundle URL. Restart npm start with the default localhost settings.");
    }
    console.log("[mobile] Preparing the Android JavaScript bundle before launch...");
    const bundle = await guard(fetch(bundleUrl, {
      signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(120_000)]),
    }));
    await bundle.body?.cancel();
    if (!bundle.ok) throw new Error(`Android bundle preparation failed (HTTP ${bundle.status}); inspect Metro's logs.`);
    console.log("[mobile] Ready: API + database + Metro. Run npm run android in Terminal 2. Keep this terminal open.");
    if (children.length > 0) await failed;
  } catch (error) {
    if (error !== interrupted) throw error;
    process.exitCode = 130;
  } finally {
    stopping = true;
    shutdown.abort(interrupted);
    for (const child of children.reverse()) {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore", windowsHide: true, timeout: 10_000,
        });
      }
    }
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}

module.exports = { startWindowsDev };
