'use strict';

const express = require('express'),
  router = express.Router();

module.exports = function (app) {
  app.use('/_health', router);
};

router.get('/', function (req, res) {
  res.sendStatus(200);
});
