'use strict';

const tzHelper = require('../helpers/timezone');
const arrayHelper = require('../helpers/array');
const global = require('../helpers/global');
const request = require('request');
const moment = require('moment-timezone');
const Promise = require('bluebird');
const WxEvent = require('../models/wxevent');
Promise.promisifyAll(require('request'));

const urlBase = 'http://kamala.cod.edu/offs/KWNS/'
const mdLsUrl = `${urlBase}acus11.chunk.html`;
let lastSeenMD = 0;
let mds = [];
const freshMDMs = 12 * 60 * 60 * 1000;
let exhaustedFreshMDs;

module.exports = {
  getMDs: _getMDs
};

function _getMDs () {
  return _fetchMDList().then(() => mds);
}

function _fetchMDList () {
  return request.getAsync(mdLsUrl)
    .then(data => {
      const kamalaIds = data.body.match(/<A HREF="\.\.\/KWNS\/(.+?)\.acus11.html/g)
        .map(x => x.match(/KWNS\/(.+?).acus11/)[1]);
      if (lastSeenMD === kamalaIds[0]) return;
      lastSeenMD = kamalaIds[0];
      exhaustedFreshMDs = false;

      return Promise.mapSeries(kamalaIds, kid => !exhaustedFreshMDs
          ? _fetchMD(kid)
          : Promise.resolve()
      );
    });
}

/**
 * Fetches a single Mesoscale Discussion.
 * @param {string} kid Kamala ID for Mesoscale Discussion.
 * @returns {Object}
 */
function _fetchMD (kid) {
  if (!kid) return;
  console.log('Fetching: ' + kid);
  return request.getAsync(`${urlBase}${kid}.acus11.html`)
    .then(data => _processMD(data.body));
}

function _processMD (rawtext) {
  rawtext = rawtext.replace(/&nbsp/g, '');
  let splits = rawtext.split('<br>')
    .map(x => {
      x = x.replace(/<B>/g, '');
      x = x.replace(/<\/B>/g, '');
      x = x.replace(/<FONT COLOR=#003366>/g, '');
      x = x.replace(/<FONT COLOR = #003366>/g, '');
      x = x.replace(/<\/FONT>/g, '');
      x = x.trim();
      return x;
    });
  splits = splits.slice(7);
  const pubDate = _parseDate(splits[2]);
  const mdNumber = splits[0].replace('MESOSCALE DISCUSSION ', '');

  // Check exhausted - assume if published more than X hours ago is not valid
  if (new Date().getTime() - pubDate > freshMDMs) {
    exhaustedFreshMDs = true;
    return;
  }

  if (!_isValidMD(splits[8])) return;

  const event = new WxEvent('swomcd', pubDate, `SPC issues Mesoscale Discussion ${mdNumber}`,
    `${splits[4]}... ${splits[6]}`, splits.join(), `http://www.spc.noaa.gov/products/md/md${mdNumber}.html`,
    'kamala', { bounds: _parseGeoFence(splits) }, `http://www.spc.noaa.gov/products/md/mcd${mdNumber}.gif`);
}

/**
 * Checks is a valid line includes the current time.
 * @param {string} line The line containing valid until information.
 * @returns {boolean}
 */
function _isValidMD (line) {
  const now = new Date();

  try {
    const untilRaw = line.split(' ')[3];
    const datediff = now.getUTCDate() - Number(untilRaw.slice(0, 2));

    // Much easier doing it this way than trying to figure out the right month/year with none provided
    if (datediff > 0) return false;
    if (datediff === 0) {
      const hourdiff = now.getUTCHours() - Number(untilRaw.slice(2, 4));
      if (hourdiff > 0) return false;
      if (hourdiff === 0 && now.getUTCMinutes() - Number(untilRaw.slice(4, 6)) > 0) return false; 
    }
  } catch (e) {
    return false;
  }

  return true;
}

function _parseGeoFence (splits) {
  let results = [];

  try {
    const raw = splits.join(' ');
    const match = raw.match(/LAT...LON([\s|\S]+?);/)[1].trim();
    const pairs = match.split(' ');
    pairs.forEach(x => {
      results.push([
        Number(x.slice(0, 4)) / 100,
        Number((x[4] === 0 ? '1' : '') + x.slice(4)) / -100
      ]);
    });
  } catch (e) {
    // Swallow
  }

  return results;
}

/**
 * Parses MD bulletin times into JavaScript date objects.
 * @param {string} datestamp The MD time string.
 * @returns {Object} JavaScript date object.
 */
function _parseDate (datestamp) {
  let zonesplit = datestamp.split(' ');
  const tz = zonesplit[2];
  zonesplit.splice(2, 1);

  return moment.tz(zonesplit.join(' '), 'hmm A ddd MMM DD YYYY',
    tzHelper.getNameFromAbbreviation(tz)).toDate();
}
