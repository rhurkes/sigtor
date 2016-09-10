'use strict';

const REFRESH_INTERVAL_MS = 60 * 1000,
  IDLE_AFTER_MS = 5 * 60 * 1000,
  RECENT_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes
const client = require('../clients/ndfd'),
  Promise = require('bluebird'),
  global = require('../helpers/global'),
  arrayHelper = require('../helpers/array');

let data = {},
  lastFetchTime = 0,
  lastGetTime = 0;

module.exports = {
  getData: _getData
};

function _getData () {
  lastGetTime = new Date().getTime();
  
  return (lastGetTime - lastFetchTime > REFRESH_INTERVAL_MS)
    ? _fetchData()
    : Promise.resolve();
}

function _fetchData () {
  if (new Date().getTime() - lastGetTime < IDLE_AFTER_MS) {
    setTimeout(() => _fetchData(), REFRESH_INTERVAL_MS);
  }

  return client.getOutlooks().then(results => {
    _populateEvents(results);
    lastFetchTime = new Date().getTime();
    data = results;
  });
}

function _populateEvents (results) {
  const outlooks = [];
  const now = new Date();
  for (let prop in results) { outlooks.push(results[prop]); }
  outlooks.sort(arrayHelper.sortBy('ts'));
  outlooks.filter(x => now - x.ts > RECENT_WINDOW_MS)
    .forEach(x => global.addEvent(x));
}
