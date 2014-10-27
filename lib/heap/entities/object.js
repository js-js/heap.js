var heap = require('../../heap');
var Base = heap.entities.Base;
var HashMap = heap.entities.HashMap;
var binding = heap.binding;

var util = require('util');

function Object(heap, ptr) {
  Base.call(this, heap, 'object', ptr);
}
util.inherits(Object, Base);
module.exports = Object;

var offsets = {
  hashmap: heap.ptrSize
};
Object.offsets = offsets;

Object.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Object.prototype.rawSize = function rawSize() {
  return Object.size();
};

Object.prototype.hashmap = function hashmap() {
  return new HashMap(this.heap,
                     binding.readTagged(this.deref(), offsets.hashmap));
};

Object.prototype.grow = function grow() {
  // Allocate temporary object and move stuff to it
  var tmp = this.heap.allocObject(this.hashmap().size() * 2);

  this.iterate(function(key, value) {
    tmp.set(key, value);
  });

  // Update hashmap
  binding.writeTagged(this.deref(), tmp.hashmap().deref(), offsets.hashmap);
};

Object.prototype.set = function set(key, value) {
  this.heap.scope(function() {
    if (!this.hashmap().set(key, value)) {
      this.grow();
      this.set(key, value);
    }
  }, this);
};

Object.prototype.get = function get(key) {
  return this.hashmap().get(key);
};

Object.prototype.iterate = function iterate(cb) {
  return this.hashmap().iterate(cb);
};

Object.prototype.toJSON = function toJSON(parents) {
  var res = {};
  var self = this;

  if (parents)
    parents.push({ handle: self, obj: res });

  this.heap.scope(function() {
    this.iterate(function(key, val) {
      key = key.toJSON();
      val = val.cast();

      if (val instanceof Object) {
        if (!parents)
          parents = [ { handle: self, obj: res } ];

        var recursive;
        parents.some(function(parent) {
          if (!parent.handle.isSame(val))
            return false;

          recursive = parent.obj;
          return true;
        });
        if (recursive)
          return res[key] = recursive;
      }
      res[key] = val.toJSON(parents);
    });
  }, this);

  if (parents)
    parents.pop();

  return res;
};
