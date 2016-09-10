'use strict';

const bunyan = require('bunyan'),
	bformat = require('bunyan-format'),
	config = require('./config'),
	loggerConfig = {
		name: 'sigtor',
		level: config.get('LOGGER_LEVEL')
	};

if (!config.get('NODE_ENV')) {
  loggerConfig.stream = bformat({outputMode: 'short'});
}

module.exports = bunyan.createLogger(loggerConfig);
