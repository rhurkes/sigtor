'use strict';

module.exports = {
  getHash: _getHash
}

function _getHash (val) {
  let hash = 0, i, chr, len;
  if (val.length === 0) return hash;
  
  for (i = 0, len = val.length; i < len; i++) {
    chr = val.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }

  return hash;
}
