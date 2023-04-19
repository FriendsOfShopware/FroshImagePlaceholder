import ThumbhashloaderPlugin from './thumbhashloader.plugin';

const PluginManager = window.PluginManager;
PluginManager.register('ThumbhashloaderPlugin', ThumbhashloaderPlugin, '.thumbhashloader');
