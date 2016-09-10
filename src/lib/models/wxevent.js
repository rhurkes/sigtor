'use strict';

// TODO how do class accessors work?
module.exports = class WxEvent {
  constructor (code, ts, text, subtext, summary, url, source, details, imageUrl) {
    this.code = code;
    this.ts = ts;
    this.text = text;
    this.subtext = subtext;
    this.summary = summary;
    this.url = url;
    this.source = source;
    this.details = details;
    this.imageUrl = imageUrl;
  }
};
