'use strict';

module.exports = {
  sortBy: _sortBy
}

function _sortBy (field, reverse, primer) {
  const key = primer ? x => primer(x[field]) : x => x[field];

  return function (a, b) {
    return a = key(a), b = key(b), !reverse ? 1 : -1 * ((a > b) - (b > a));
  };
}
