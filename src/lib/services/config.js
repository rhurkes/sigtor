'use strict';

const path = require('path'),
  fs = require('fs'),
  nconf = require('nconf'),
  CONFIG_BASE_PATH = '../../config/',
  DEV_ENV = 'development';

const nodeEnv = (process.env.NODE_ENV || DEV_ENV);

if (nodeEnv !== DEV_ENV) {
  const configPath = path.join(__dirname, CONFIG_BASE_PATH, nodeEnv + '.json');
  
  fs.exists(configPath, function (exists) {
    if (!exists) {
      // cannot use services/logger here b/c it causes a circular dependency
      console.error('Failed to load config for NODE_ENV=' + nodeEnv + '. File not found: ' + configPath);
    }
  });
}

nconf
  .argv()
  .env()
  .file(nodeEnv, path.join(__dirname, CONFIG_BASE_PATH, nodeEnv + '.json'))
  .file('default', path.join(__dirname, CONFIG_BASE_PATH, 'default.json'));

module.exports = nconf;
