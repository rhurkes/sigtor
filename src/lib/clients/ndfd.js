/*
  NOTES:
  http://www.nws.noaa.gov/ndfd/anonymous_ftp.htm
  SL.us008001/ Data root: for NWS Telecommunication Gateway Server (top directory)
  DS.swoac - SPC Outlooks
  DS.svrwu - Severe Thunderstorm Warnings
  DS.codas - Coded Surface Fronts
  DS.ffawg - Flood Watch
  DS.ffswg - Flash Flood Statement
  DS.ffwwg - Flash Flood Warnings
  DS.flwwg - Flood Warnings
  DS.selww - Watches
  DS.spsww - Special Weather Statement
  DS.torwf - Tornado Warnings
*/

// TODO go through and jsdoc functions
// TODO figure out JSDoc @returns
// TODO: make this more efficient and exit early
// TODO use strict mode and use the correct block level let/const for ALL files
// TODO handle Unhandled rejection Error: getaddrinfo ENOTFOUND weather.noaa.gov weather.noaa.gov:80

'use strict';

const tzHelper = require('../helpers/timezone');
const arrayHelper = require('../helpers/array');
const global = require('../helpers/global');
const request = require('request');
const moment = require('moment-timezone');
const Promise = require('bluebird');
const WxEvent = require('../models/wxevent');
Promise.promisifyAll(require('request'));

const ndfdBase = 'http://weather.noaa.gov/pub/SL.us008001/DF.c5/DC.textf/'
const lsrBase = `${ndfdBase}DS.lsrnw/`;
const lsrLsUrl = `${lsrBase}ls-lt`;
const outlookBase = `${ndfdBase}DS.swoac/`;
const outlookLsUrl = `${outlookBase}ls-lt`;
const lsrMaxHours = 2;
const events = [];
const lastSeenNDFDOutlookKey = 'ndfd-outlook-lastseenfile';
const outlooksFoundKey = 'ndfd-outlooks-found';
const outlookListDelay = 60 * 1000; // 60 seconds
let outlookLastProcessedTime = 0;
let ndfdOutlooksFound = {};
let lastfile;
let processing = false;
const freshnesstime = 5 * 60 * 1000;  // 5 minutes
let outlooks = {};

const OutlookRisk = Object.freeze({
  NONE: 'NONE',
  MRGL: 'MRGL',
  SLGT: 'SLGT',
  ENH: 'ENG',
  MDT: 'MDT',
  HIGH: 'HIGH'
});

module.exports = {
  getLsrs: _getLsrs,
  getOutlooks: _getOutlooks
};

function _getOutlooks () {
  return _fetchOutlookList().then(() => outlooks);
}

function _getLsrs () {
  return _fetchLsrList()
    .then(data => {
      return Promise.all(data.map(x => _fetchLsr(x.filename)));
    })
    .then(() => events.sort(arrayHelper.sortBy('timeUtc')));
}

function _fetchLsrList () {
  return request.getAsync(nwsLsrLs)
    .then(data => {
      const now = new Date();
      const lsrFiles = [];
      const lines = data.body.split('\n');
      
      lines.forEach(line => {
        const date = new Date(`${line.substr(45, 12)} ${now.getFullYear()} UTC`);
        
        // If month is greater than current month, it's the previous year
        if (date.getMonth() > now.getMonth()) {
          date.setFullYear = now.getFullYear - 1;
        }

        const filename = line.substr(58, 11);
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - lsrMaxHours);
        if (date < cutoff) return;
        lsrFiles.push({ date, filename });
      });

      return lsrFiles;
    });
};

function _fetchLsrs (lsrFiles) {
  var lsrTasks = lsrFiles.map(x => _fetchLsr(x.filename));
  return Promise.all(lsrTasks);
}

function _fetchLsr (filename) {
  const url = `${nwsLsrBase}${filename}`;
  return request.getAsync(url)
    .then(data => {
      var lsrs = data.body.split('\n####');

      lsrs.forEach(lsr => {
        var event = { type: 'lsr' };
        var chunks = lsr.split('\r\r\n\r\r\n');
        event.wfo = chunks[0].substring(chunks[0].length - 3);
        var timesplit = chunks[1].split('\r\r\n');
        var time = timesplit[timesplit.length - 1];
        event.ts = _parseTime(time);
        event.text = chunks[4].trim();
        event.url = url;
        // TODO get real time
        var halves = chunks[3].split('\r\r\n');
        var time = halves[0].substr(0, 4);
        var ampm = halves[0].substr(5, 2);
        var coords = halves[0].substr(53).trim();
        var date = halves[1].substr(0, 10);

        event.data = {
          type: halves[0].substr(12, 17).trim(),
          mag: halves[1].substr(12, 17).trim(),
          location: halves[0].substr(29, 24).trim(),
          lat: parseFloat(coords.substr(0, 5)),
          lon: -1 * parseFloat(coords.substr(6).replace('W', '').trim()),
          county: halves[1].substr(29, 18).trim(),
          state: halves[1].substr(48, 2),
          source: halves[1].substr(53).trim()
        };
        
        events.push(event);
      });
  });
}

function _fetchOutlookList () {
  return request.getAsync(outlookLsUrl)
    .then(data => {
      let lines = _parseLsLines(data.body);
      const firstfile = lines[0].filename;
      if (firstfile === lastfile) return;

      const lastfileIndex = lines.findIndex(x => x.filename === lastfile);
      lines = (lastfileIndex > -1) ? lines.slice(0, lastfileIndex + 1) : lines;
      lastfile = firstfile;

      return Promise.mapSeries(lines, line => !_AllOutlooksFound(outlookLastProcessedTime)
          ? _fetchOutlook(line.filename)
          : Promise.resolve()
      );
    })
    .then(() => outlookLastProcessedTime = 0);
}

class LsLine {
  constructor(date, filename) {
    this.date = date;
    this.filename = filename;
  }
}

/**
 * Fetches a single outlook filename.
 * @param {string} filename Filename to retrieve.
 * @returns {Object}
 */
function _fetchOutlook (filename) {
  if (!filename) return;
  console.log('Fetching: ' + filename);
  return request.getAsync(`${outlookBase}${filename}`)
    .then(data => _processOutlook(data));
}

/**
 * Parses raw text from an ls process, and returns an array of ls lines.
 * Optionally exits early based on cutoff passed in.
 * @param {string} raw Raw text results of ls operation.
 * @param {Object} [cutoff] Date object for cutoff, do not process lines with earlier timestamps.
 * @returns {LsLine[]} An array of parsed ls lines.
 */
function _parseLsLines (raw, cutoff) {
  const parsedLines = [];
  const lines = raw.split('\n');

  lines.forEach((line, index) => {
    try {
      // Values: permissions, ?, ?, ?, size, month, day, time, filename
      const splits = line.split(/\s+/);
      const parsedLine = {};
      const now = new Date();
      const date = new Date(`${splits[5]} ${splits[6]} ${splits[7]} ${now.getUTCFullYear()} UTC`);

      // Year not in ls output, assume current year, but check the month just in case
      if (date.getUTCMonth() > now.getUTCMonth()) {
        date.setUTCFullYear(now.getUTCFullYear() - 1);
      }

      parsedLines.push(new LsLine(date, splits[8]));
    } catch (e) {
      console.log(`Unable to parse line ${index}: ${JSON.stringify(line)}\n${e}`);
    }
  });

  return parsedLines;
}

/**
 * Parses NDFD times into ISO 8601 strings
 * @param {string} ndfdTime The NDFD time string.
 * @returns {Object} JavaScript date object.
 */
function _parseTime (ndfdTime) {
  let time = ndfdTime;
  let zonesplit = time.split(' ');
  const tz = zonesplit[2];
  zonesplit.splice(2, 1);

  return moment.tz(zonesplit.join(' '), 'hmm A ddd MMM DD YYYY', tzHelper.getNameFromAbbreviation(tz)).toDate();
}

/**
 * Parses outlook text to identify risk level.
 * @param {string} text Outlook text.
 * @returns {Object} Risk level enumeration: NONE, MRGL, SLGT, ENH, MDT, HIGH.
 */
function _parseRiskLevel (text) {
  let risk = OutlookRisk.NONE;
  const normalizedText = text.toLowerCase();

  if (normalizedText.indexOf('there is a mrgl risk') > -1) risk = OutlookRisk.MRGL;
  if (normalizedText.indexOf('there is a slgt risk') > -1) risk = OutlookRisk.SLGT;
  if (normalizedText.indexOf('there is an enh risk') > -1) risk = OutlookRisk.ENH;
  if (normalizedText.indexOf('there is a mdt risk') > -1) risk = OutlookRisk.MDT;
  if (normalizedText.indexOf('there is a high risk') > -1) risk = OutlookRisk.HIGH;

  return risk;
}

/**
 * Parses outlook file and builds up WxEvent. Also updates which outlooks have been found.
 * @param {WxEvent} wxevent Instance of WxEvent class containing a valid timestamp and a valid code, ie. 'SWODY1'.
 */
function _processOutlook (raw) {
  const urlBase = 'http://www.spc.noaa.gov/products/';
  let processedTime = 0;
  const wxevent = new WxEvent();

  try {
    const lines = raw.body.split('\n').map(l => l.replace('\r\r', '').trim());
    wxevent.code = lines[2].toLowerCase();
    wxevent.ts = _parseTime(lines[7]);
    outlookLastProcessedTime = wxevent.ts.getTime();

    if (typeof ndfdOutlooksFound[wxevent.code] === 'number'
      && wxevent.ts.getTime() < ndfdOutlooksFound[wxevent.code]) return;

    switch (wxevent.code) {
      case 'swody1':
        wxevent.url = `${urlBase}outlook/day1otlk.html`;
        wxevent.imageUrl = `${urlBase}outlook/day1otlk.gif`;
        break;
      case 'swody2':
        wxevent.url = `${urlBase}outlook/day2otlk.html`;
        wxevent.imageUrl = `${urlBase}outlook/day2otlk.gif`;
        break;
      case 'swody3':
        wxevent.url = `${urlBase}outlook/day3otlk.html`;
        wxevent.imageUrl = `${urlBase}outlook/day3otlk.gif`;
        break;
      case 'swod48':
        wxevent.url = `${urlBase}exper/day4-8/`;
        wxevent.imageUrl = `${urlBase}exper/day4-8/day48prob.gif`;
        break;
      default:
        break;
    }

    wxevent.summary = `SPC issues ${lines[5]}`;
    wxevent.source = 'spc';
    wxevent.text = raw.body;
    // TODO doesn't work for 4-8
    wxevent.details = {
      risk: _parseRiskLevel(wxevent.text)
    };

    ndfdOutlooksFound[wxevent.code] = processedTime;
    outlooks[wxevent.code] = wxevent;
  } catch (e) {
    console.log(`Unable to process outlook\n${wxevent}\n${e}`);
  }
}

/**
 * Determines if all outlooks have been found, to allow for short-circuiting of various logic.
 * @param {number} time Last processed timestamp in epoch time.
 * @returns {boolean}
 */
function _AllOutlooksFound (time) {
  return time !== 0 && time < ndfdOutlooksFound.swody1
    && time < ndfdOutlooksFound.swody2 && time < ndfdOutlooksFound.swody3
    && time < ndfdOutlooksFound.swod48;
}
