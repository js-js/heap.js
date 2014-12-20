var heap = require('../../heap');
var Base = heap.entities.Base;
var Field = heap.entities.Field;
var AttrDict = heap.entities.dict.Attr;
var ArrayDict = heap.entities.dict.Array;
var binding = heap.binding;
var constants = heap.constants;

var assert = require('assert');
var util = require('util');

function Object(heap, ptr) {
  Base.call(this, heap, 'object', ptr);
}
util.inherits(Object, Base);
module.exports = Object;

var offsets = {
  flags: heap.ptrSize,
  field: 2 * heap.ptrSize
};
Object.offsets = offsets;
Object.minSize = 8;

var flags = {
  dense: 0x1
};
Object.flags = flags;

Object.size = function size() {
  return this.super_.size() + 2 * heap.ptrSize;
};

Object.prototype.rawSize = function rawSize() {
  return Object.size();
};

Object.prototype.flags = function flags() {
  return binding.readTagged(this.deref(), offsets.flags);
};

Object.prototype._updateFlags = function _updateFlags(value) {
  return binding.writeTagged(this.deref(), value, offsets.flags);
};

Object.prototype.isDense = function isDense() {
  return (this.flags() & flags.dense) !== 0;
};

Object.prototype.field = function field() {
  return new Field(this.heap,
                   binding.readTagged(this.deref(), offsets.field));
};

Object.prototype.dict = function dict(field) {
  if (!field)
    field = this.field();

  if (this.isDense())
    return new ArrayDict(field);
  else
    return new AttrDict(field);
};

Object.prototype.grow = function grow(min) {
  var dict = this.dict();
  var size = dict.size();

  var nsize = 2 * dict.field.size();
  while (nsize < min)
    nsize *= 2;

  // Try growing hashmap until there will be enough space to fit all
  // properties
  for (; ; nsize *= 2) {
    var nfield = this.heap.allocField(nsize);
    binding.writeTagged(this.deref(), nfield.deref(), offsets.field);
    var ndict = this.dict(nfield);

    for (var i = 0; i < size; i++) {
      var key = dict.getKey(i);
      if (key.isHole())
        continue;

      var slot = this._getPropertySlot(ndict, key, true, {
        growing: true
      });
      if (slot === null)
        break;

      ndict.setValue(slot, dict.getValue(i));
      ndict.setMeta(slot, dict.getMeta(i));
    }

    if (i === size)
      break;
  }
};

Object.prototype._mask = function mask(dict) {
  return dict.size() - 1;
};

Object.prototype._transitionToArray = function _transitionToArray(dict) {
  this._updateFlags(this.flags() & ~flags.dense);
  this._updateMap(this.heap.maps.array);

  var size = dict.size();
  var nfield = this.heap.allocField(2 * AttrDict.offsets.itemSize * size);
  binding.writeTagged(this.deref(), nfield.deref(), offsets.field);

  for (var i = 0; i < size; i++) {
    var value = dict.getValue(i);
    if (value.isHole())
      continue;
    this.set(dict.getIndex(i), value);
  }

  return this.dict();
};

Object.prototype._denseUpdate = function _denseUpdate(dict, key) {
  if (dict.size() <= key.value())
    this.grow(key.value() + 1);

  // TODO(indutny): update length property
};

Object.prototype._getPropertySlot = function _getPropertySlot(dict,
                                                              key,
                                                              update,
                                                              options) {
  var res = this.heap.scope(function() {
    key = key.cast();

    if (this.isDense()) {
      // Not found
      if (key.type !== 'smi')
        return { index: null, transition: false };

      if (update)
        this._denseUpdate(dict, key);

      return { index: key.value(), transition: false };
    }

    var mask = this._mask(dict);
    var index = key.hash() & mask;
    var existing = false;

    for (var tries = 0;
         tries < constants.object.maxTries;
         tries++, index = (index + 1) & mask) {

      var h = dict.getKey(index);
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
      dict.setKey(index, key);
    return { index: index, transition: update && !existing };
  }, this);

  if (update && !(options && options.growing)) {
    // Growth required
    if (res.index === null) {
      return this.heap.scope(function() {
        this.grow();
        return this._getPropertySlot(this.dict(), key, update, options);
      }, this);

    // Transition required
    } else if (res.transition && !(options && options.noTransition)) {
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
  var res = this._getPropertySlot(this.dict(), key, update);
  if (res === null)
    return this.heap.undef;
  else
    return this.heap.smi(res);
};

Object.prototype.set = function set(key, value, options) {
  var dict = this.dict();
  key = key.cast();

  var attrs = options && options.attributes ||
              this.heap.smi(dict.attributes['default']);

  if (this.isDense()) {
    // Non Smi - transition to regular array
    if (key.type !== 'smi' ||
        (attrs.value() & ~dict.attributes.denseMask) !== 0) {
      dict = this._transitionToArray(dict);
    }
  }

  var slot = this._getPropertySlot(dict, key, true, options);

  // Time-waste, but in fact dict could be updated here
  dict = this.dict();

  var meta = {
    attributes: attrs
  };
  dict.setMeta(slot, meta);
  dict.setValue(slot, value);
};

Object.prototype.get = function get(key, shallow) {
  var dict = this.dict();
  var slot = this._getPropertySlot(dict, key, false);

  // Time-waste, but in fact dict could be updated here
  dict = this.dict();

  if (slot !== null)
    return dict.getValue(slot);

  if (shallow)
    return this.heap.undef;

  return this.heap.scope(function() {
    // Perform prototype-chain lookup
    var proto = this.map().proto();
    for (; !proto.isHole(); proto = proto.map().proto()) {
      var res = proto.get(key, true);
      if (res !== null)
        return res;
    }

    return this.heap.undef;
  }, this);
};

Object.prototype.iterate = function iterate(cb) {
  var dict = this.dict();
  var size = dict.size();

  for (var i = 0; i < size; i++) {
    var key = dict.getKey(i);
    if (key.isHole())
      continue;

    var attrs = dict.getMeta(i).attributes.cast().value();
    if (attrs & dict.attributes.enumerable) {
      var value = dict.getValue(i);
      cb(key, value);
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
  var dict = this.dict();
  var size = dict.size();

  // Count keys first
  var count = 0;
  for (var i = 0; i < size; i++) {
    var key = dict.getKey(i);
    if (!key.isHole())
      count++;
  }

  // Copy keys
  var res = this.heap.allocField(count);
  for (var i = 0, j = 0; i < size; i++) {
    var key = dict.getKey(i);
    if (!key.isHole())
      res.set(j++, key);
  }

  return res;
};

Object.prototype.visit = function visit(cb, ptr) {
  if (!ptr)
    ptr = this.ptr();
  Object.super_.prototype.visit.call(this, cb, ptr);

  // Field
  cb(ptr, offsets.field, 'field');
};
