var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;

var util = require('util');

function HashMap(ptr) {
  Base.call(this, 'hashmap', ptr);
}
util.inherits(HashMap, Base);
module.exports = HashMap;

HashMap.prototype.size = function size() {
  return binding.readTagged(this.ptr, 8);
};
