'use strict';

const express = require('express'),
  router = express.Router(),
  global = require('../lib/helpers/global'),
  outlookStore = require('../lib/stores/outlooks'),
  Promise = require('bluebird'),
  kamala = require('../lib/clients/kamala');

module.exports = app => app.use('/api/events', router);

// TODO if eventid is 0, include active swody1/watches/mds/warnings in the response

router.get('/', (req, res) => {
  const tasks = [];
  //tasks.push(outlookStore.getData());
  tasks.push(kamala.getMDs());
  Promise.all(tasks).then(() => res.json(global.events));
});
