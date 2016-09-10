'use strict';

module.exports = {
  getNameFromAbbreviation: _getNameFromAbbreviation
};

function _getNameFromAbbreviation (abbrev) {
  const tzDefault = 'GMT';
  if (typeof abbrev !== 'string') return tzDefault;
  const normalized = abbrev.toUpperCase();
  
  if (['ET', 'EST', 'EDT'].indexOf(normalized) > -1) {
    return 'America/New_York';
  } else if (['MT', 'MST', 'MDT'].indexOf(normalized) > -1) {
    return 'America/Denver';
  }  else if (['CT', 'CST', 'CDT'].indexOf(normalized) > -1) {
    return 'America/Chicago';
  }  else if (['PT', 'PST', 'PDT'].indexOf(normalized) > -1) {
    return 'America/Los_Angeles';
  }  else if (['AKT', 'AKST', 'AKDT'].indexOf(normalized) > -1) {
    return 'America/Anchorage';
  }  else if (['HT', 'HST'].indexOf(normalized) > -1) {
    return 'US/Hawaii';
  } else {
    return tzDefault;
  }
}
