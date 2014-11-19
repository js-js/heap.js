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

Object.prototype.grow = function grow(min) {
  var size = this.size();
  var field = this.field();
  var isDense = this.map().isDenseArray();

  var nsize = 2 * size;
  while (nsize < min)
    nsize *= 2;

  // Try growing hashmap until there will be enough space to fit all
  // properties
  for (; ; nsize *= 2) {
    var nfield = this.heap.allocField(2 * nsize);
    binding.writeTagged(this.deref(), nfield.deref(), offsets.field);

    if (isDense) {
      for (var i = 0; i < size; i++) {
        var value = field.get(i);
        if (value.isHole())
          continue;

        var res = this.set(this.heap.smi(i), value);
        if (res === null)
          break;
      }
    } else {
      for (var i = 0; i < size; i++) {
        var key = field.get(2 * i);
        if (key.isHole())
          continue;

        var res = this.set(key, field.get(2 * i + 1));
        if (res === null)
          break;
      }
    }

    if (i === size)
      break;
  }
};

Object.prototype._mask = function mask() {
  return this.size() - 1;
};

Object.prototype._transitionToArray = function _transitionToArray(field) {
  this._updateMap(this.heap.maps.array);
  var size = field.size();
  var nfield = this.heap.allocField(4 * size);
  binding.writeTagged(this.deref(), nfield.deref(), offsets.field);

  for (var i = 0; i < size; i++) {
    var value = field.get(i);
    if (value.isHole())
      continue;
    this.set(this.heap.smi(i), value);
  }

  return this.field();
};

Object.prototype._denseUpdate = function _denseUpdate(field, key) {
  if (field.size() <= key.value())
    this.grow(key.value() + 1);

  // TODO(indutny): update length property
};

Object.prototype._getPropertySlot = function _getPropertySlot(
    field,
    key,
    update,
    noTransition) {
  var res = this.heap.scope(function() {
    key = key.cast();

    if (this.map().isDenseArray()) {
      if (key.type === 'smi') {
        if (update)
          this._denseUpdate(field, key);

        return { index: key.value(), transition: false };
      }

      // Non Smi - transition to regular array
      field = this._transitionToArray(field);
    }

    var mask = this._mask();
    var index = key.hash() & mask;
    var existing = false;

    for (var tries = 0;
         tries < constants.object.maxTries;
         tries++, index = (index + 1) & mask) {

      var h = field.get(index * 2);
      if (h.isHole()) {
        if (update)
          break;
        else
          return { index: null, transition: false };
      }

      if (!key.isSame(h))
        continue;

      if (!update)
        return { index: index, transition: false };

      existing = true;
      break;
    }

    if (tries === constants.object.maxTries)
      return { index: null, transition: false };

    // New property is inserted
    if (update && !existing)
      field.set(index * 2, key);
    return { index: index, transition: update && !existing };
  }, this);

  if (update) {
    // Grow required
    if (res.index === null) {
      return this.heap.scope(function() {
        this.grow();
        return this._getPropertySlot(field, key, update, noTransition);
      }, this);

    // Transition required
    } else if (res.transition && !noTransition) {
      this.heap.scope(function() {
        var map = this.map().transition(key, this);
        if (map)
          this._updateMap(map);
      }, this);
    }
  }

  return res.index;
};

Object.prototype.getPropertySlot = function getPropertySlot(key, update) {
  var res = this._getPropertySlot(this.field(), key, update);
  if (res === null)
    return this.heap.undef;
  else
    return this.heap.smi(res);
};

Object.prototype.set = function set(key, value, noTransition) {
  var field = this.field();
  var slot = this._getPropertySlot(field, key, true, noTransition);

  // Time-waste, but in fact field could be updated here
  field = this.field();

  if (this.map().isDenseArray())
    field.set(slot, value);
  else
    field.set(slot * 2 + 1, value);
};

Object.prototype.get = function get(key, shallow) {
  var field = this.field();
  var slot = this._getPropertySlot(field, key, false);

  // Time-waste, but in fact field could be updated here
  field = this.field();

  if (slot !== null) {
    if (this.map().isDenseArray())
      return field.get(slot);
    else
      return field.get(slot * 2 + 1);
  }

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

  if (this.map().isDenseArray()) {
    for (var i = 0; i < size; i++) {
      var value = field.get(i);
      if (value.isHole())
        continue;
      cb(this.heap.smi(i), value);
    }
  } else {
    for (var i = 0; i < size; i++) {
      var key = field.get(2 * i);
      if (key.isHole())
        continue;
      cb(key, field.get(2 * i + 1));
    }
  }
};

Object.prototype.toJSON = function toJSON(parents, res) {
  if (!res)
    res = {};
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
    if (!key.isHole())
      count++;
  }

  // Copy keys
  var res = this.heap.allocField(count);
  for (var i = 0, j = 0; i < size; i++) {
    var key = field.get(2 * i);
    if (!key.isHole())
      res.set(j++, key);
  }

  return res;
};
