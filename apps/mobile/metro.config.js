const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// pnpm creates ephemeral *_tmp_<pid> dirs inside node_modules; Metro's watcher
// tries to read them after deletion → jsBigFileString::fromPath / ENOENT crash.
const tmpDirBlock = /(^|[/\\])node_modules[/\\].*_tmp_\d+([/\\]|$)/;

const existingBlock = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlock) ? existingBlock : existingBlock ? [existingBlock] : []),
  tmpDirBlock,
  /[/\\]\.git[/\\]/,
  /[/\\]\.turbo[/\\]/,
  /[/\\]\.next[/\\]/,
];

config.watcher = {
  ...config.watcher,
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
  },
};

module.exports = config;
