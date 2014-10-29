var heap = require('../../heap');
var Object = heap.entities.Object;

var util = require('util');

function Global(heap, ptr) {
  Object.call(this, heap, ptr);

  this.type = 'global';
}
util.inherits(Global, Object);
module.exports = Global;

Global.offsets = Object.offsets;
Global.size = Object.size;
