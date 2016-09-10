'use strict';

const express = require('express');
const compression = require('compression');
const path = require('path');
const glob = require('glob');

module.exports = () => {
  const app = express();
  app.use(compression());

	// Dynamically load all routes
  const routesPath = path.join(__dirname, 'routes');
  const routes = glob.sync(`${routesPath}/*.js`);
  routes.forEach(function (route) {
    require(route)(app);
  });

  return app;
};
