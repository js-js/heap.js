var heap = require('../../heap');
var Base = heap.entities.Base;
var HashMap = heap.entities.HashMap;
var binding = heap.binding;

var util = require('util');

function Object(heap, ptr) {
  Base.call(this, heap, 'object', ptr);

  this._hashmap = null;
}
util.inherits(Object, Base);
module.exports = Object;

Object.prototype.hashmap = function hashmap() {
  if (this._hashmap === null) {
    this._hashmap = new HashMap(this.heap,
                                binding.readTagged(this.ptr, heap.ptrSize));
  }
  return this._hashmap;
};

Object.prototype.grow = function grow() {
  // Allocate temporary object and move stuff to it
  var tmp = new Object(this.heap, this.ptr);
  tmp._hashmap = this.heap.allocHashMap(this.hashmap().size() * 2);

  this.iterate(function(key, value) {
    tmp.set(key, value);
  });
  this._hashmap = tmp._hashmap;
  binding.writeTagged(this.ptr, tmp._hashmap.ptr, heap.ptrSize);
};

Object.prototype.set = function set(key, value) {
  if (!this.hashmap().set(key, value)) {
    this.grow();
    this.set(key, value);
  }
};

Object.prototype.get = function get(key) {
  return this.hashmap().get(key);
};

Object.prototype.iterate = function iterate(cb) {
  return this.hashmap().iterate(cb);
};
