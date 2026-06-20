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

// pnpm/Metro create ephemeral *_tmp_<pid> dirs; watching them crashes FallbackWatcher (ENOENT)
const blockList = [
  /\/node_modules\/.*_tmp_\d+\//,
  /\/node_modules\/\.pnpm\/.*_tmp_\d+\//,
];

config.resolver.blockList = Array.isArray(config.resolver.blockList)
  ? [...config.resolver.blockList, ...blockList]
  : blockList;

module.exports = config;
