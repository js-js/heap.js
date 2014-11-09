var heap = require('../../heap');
var Base = heap.entities.Base;
var Field = heap.entities.Field;
var binding = heap.binding;
var constants = heap.constants;

var util = require('util');

function Object(heap, ptr) {
  Base.call(this, heap, 'object', ptr);
}
util.inherits(Object, Base);
module.exports = Object;

var offsets = {
  field: heap.ptrSize
};
Object.offsets = offsets;

Object.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Object.minSize = 8;

Object.prototype.rawSize = function rawSize() {
  return Object.size();
};

Object.prototype.field = function field() {
  return new Field(this.heap,
                   binding.readTagged(this.deref(), offsets.field));
};

Object.prototype.size = function size() {
  return this.field().size() / 2;
};

Object.prototype.grow = function grow() {
  // Allocate temporary object and move stuff to it
  var tmp = this.heap.allocObject(this.size() * 2);

  this.iterate(function(key, value) {
    tmp.set(key, value);
  });

  // Update field
  binding.writeTagged(this.deref(), tmp.field().deref(), offsets.field);
};

Object.prototype._mask = function mask() {
  return this.size() - 1;
};

Object.prototype._set = function _set(key, value) {
  return this.heap.scope(function() {
    var update = false;
    var mask = this._mask();
    var field = this.field();

    var index = key.cast().hash() & mask;
    for (var tries = 0;
         tries < constants.object.maxTries;
         tries++, index = (index + 1) & mask) {

      var h = field.get(index * 2);
      if (this.heap.isHole(h))
        break;

      if (!key.isSame(h))
        continue;

      update = true;
      break;
    }

    // Space is too small to hold the keypair
    if (tries === constants.object.maxTries)
      return null;

    if (!update)
      field.set(index * 2, key);
    field.set(index * 2 + 1, value);

    return !update;
  }, this);
};

Object.prototype._get = function _get(key) {
  return this.heap.scope(function() {
    key = key.cast();

    var field = this.field();
    var mask = this._mask();
    var index = key.hash() & mask;

    for (var tries = 0;
         tries < constants.object.maxTries;
         tries++, index = (index + 1) & mask) {

      var h = field.get(index * 2);
      if (this.heap.isHole(h))
        break;

      if (!key.isSame(h))
        continue;

      var res = field.get(index * 2 + 1);
      return this.heap.wrap(res);
    }

    return null;
  }, this);
};

Object.prototype.set = function set(key, value, noTransition) {
  var res = this._set(key, value);

  // Retry
  if (res === null) {
    this.heap.scope(function() {
      this.grow();
      this.set(key, value);
    }, this);

  // New property, transition hidden class
  } else if (res === true && !noTransition) {
    this.heap.scope(function() {
      var map = this.map().transition(key, this);
      if (map)
        this._updateMap(map);
    }, this);
  }
};

Object.prototype.get = function get(key, shallow) {
  var res = this._get(key);
  if (res !== null)
    return res;

  if (shallow)
    return this.heap.undef;

  return this.heap.scope(function() {
    // Perform prototype-chain lookup
    var map = this.map();
    for (; !map.isSame(this.heap.maps.map); map = map.parent()) {
      var proto = map.proto();
      if (proto.isSame(this.heap.hole))
        break;

      var res = proto.get(key, true);
      if (res !== null)
        return res;
    }

    return this.heap.undef;
  }, this);
};

Object.prototype.iterate = function iterate(cb) {
  var size = this.size();
  var field = this.field();
  for (var i = 0; i < size; i++) {
    var key = field.get(2 * i);
    if (this.heap.isHole(key))
      continue;
    cb(key, field.get(2 * i + 1));
  }
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

Object.prototype.keys = function keys() {
  var size = this.size();
  var field = this.field();

  // Count keys first
  var count = 0;
  for (var i = 0; i < size; i++) {
    var key = field.get(2 * i);
    if (!this.heap.isHole(key))
      count++;
  }

  // Copy keys
  var res = this.heap.allocField(count);
  for (var i = 0, j = 0; i < size; i++) {
    var key = field.get(2 * i);
    if (!this.heap.isHole(key))
      res.set(j++, key);
  }

  return res;
};
