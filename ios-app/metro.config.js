const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../resources'), path.resolve(__dirname, '../public')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.resolveRequest = (context, moduleName, platform) => context.resolveRequest(context,
  moduleName.startsWith('@/') ? path.resolve(__dirname, '../resources/js', moduleName.slice(2)) : moduleName, platform);
module.exports = config;
