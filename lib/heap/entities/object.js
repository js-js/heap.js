var heap = require('../../heap');
var Base = heap.entities.Base;
var HashMap = heap.entities.HashMap;
var binding = heap.binding;

var util = require('util');

function Object(ptr) {
  Base.call(this, 'object', ptr);
}
util.inherits(Object, Base);
module.exports = Object;

Object.prototype.hashmap = function hashmap() {
  return new HashMap(binding.readTagged(this.ptr, 8));
};
