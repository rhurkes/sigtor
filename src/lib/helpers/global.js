// TODO trim events after time/size limits
// TODO save id to fs and reload
// TODO roll over to a smaller number at some point

'use strict';

let _events = [];
let _id = 1;

module.exports = {
  events: _events,
  addEvent: _addEvent
};

function _addEvent (event) {
  if (typeof event.id !== 'undefined') return;
  _id++;
  event.id = _id;
  _events.push(event);
}
