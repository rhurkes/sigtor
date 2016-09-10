'use strict';

const logger = require('./lib/services/logger');
const config = require('./lib/services/config');
// TODO Why do I need function expression here?
const app = require('./app')();
const port = config.get('PORT'); 

app.set('port', port);

app.listen(port, function () {
  logger.info('Server listening on port %s', port);
});
