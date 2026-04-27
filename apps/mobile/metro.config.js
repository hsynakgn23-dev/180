const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// NodeNext-style .js imports (e.g. ./foo.js) need to resolve to .ts in Metro
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    const tsName = moduleName.slice(0, -3) + '.ts';
    try {
      return (defaultResolveRequest || context.resolveRequest)(context, tsName, platform);
    } catch (_) {}
    const tsxName = moduleName.slice(0, -3) + '.tsx';
    try {
      return (defaultResolveRequest || context.resolveRequest)(context, tsxName, platform);
    } catch (_) {}
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
