var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;
var constants = heap.constants;

var util = require('util');
var Buffer = require('buffer').Buffer;

function HashMap(heap, ptr) {
  Base.call(this, heap, 'hashmap', ptr);
}
util.inherits(HashMap, Base);
module.exports = HashMap;

HashMap.prototype._rawSize = function _rawSize() {
  return (1 + 2 * this.size()) * heap.ptrSize;
};

HashMap.prototype.size = function size() {
  return binding.readTagged(this.deref(), heap.ptrSize);
};

HashMap.prototype.mask = function mask() {
  return this.size() - 1;
};

HashMap.prototype._getCell = function _getCell(index) {
  return this.heap.wrap(
       binding.readTagged(this.deref(), (2 + index) * heap.ptrSize));
};

HashMap.prototype._setCell = function _setCell(index, val) {
  return binding.writeTagged(this.deref(),
                             val.deref(),
                             (2 + index) * heap.ptrSize);
};

HashMap.prototype.set = function set(key, val) {
  var update = false;
  var index = key.cast().hash() & this.mask();

  return this.heap.scope(function() {
    for (var tries = 0;
         tries < constants.hashmap.maxTries;
         tries++, index = (index + 1) & this.mask()) {

      var h = this._getCell(index * 2);
      if (this.heap.isHole(h))
        break;

      if (!key.isSame(h))
        continue;

      update = true;
      break;
    }

    // Space is too small to hold the keypair
    if (tries === constants.hashmap.maxTries)
      return false;

    if (!update)
      this._setCell(index * 2, key);
    this._setCell(index * 2 + 1, val);

    return true;
  }, this);
};

HashMap.prototype.get = function get(key) {
  var index = key.cast().hash() & this.mask();

  return this.heap.scope(function() {
    for (var tries = 0;
         tries < constants.hashmap.maxTries;
         tries++, index = (index + 1) & this.mask()) {

      var h = this._getCell(index * 2);
      if (this.heap.isHole(h))
        break;

      if (!key.isSame(h))
        continue;

      var res = this._getCell(index * 2 + 1);
      return this.heap.wrap(res);
    }

    return null;
  }, this);
};

HashMap.prototype.iterate = function iterate(cb) {
  var size = this.size();

  for (var i = 0; i < size; i++) {
    var key = this._getCell(i * 2);
    if (this.heap.isHole(key))
      continue;

    cb(key, this._getCell(i * 2 + 1));
  }
};
