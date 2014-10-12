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
  return 1 + 2 * this.size() * heap.ptrSize;
};

HashMap.prototype.size = function size() {
  return binding.readTagged(this.ptr, heap.ptrSize);
};

HashMap.prototype.mask = function mask() {
  return this.size() - 1;
};

HashMap.prototype._getCell = function _getCell(index) {
  return binding.readTagged(this.ptr, (2 + index) * heap.ptrSize);
};

HashMap.prototype._setCell = function _setCell(index, val) {
  return binding.writeTagged(this.ptr, val, (2 + index) * heap.ptrSize);
};

HashMap.prototype.set = function set(key, val) {
  var update = false;
  var index;
  if (typeof key === 'number')
    index = utils.hashNumber(key) & this.mask();
  else
    index = key.hash() & this.mask();

  for (var tries = 0;
       tries < constants.hashmap.maxTries;
       tries++, index = (index + 1) & this.mask()) {

    var ptr = this._getCell(index * 2);
    if (typeof ptr === 'number') {
      if (typeof key !== 'number')
        continue;

      if (key !== ptr)
        continue;
    } else {
      if (this.heap.isHole(ptr))
        break;

      if (!key.isSame(ptr))
        continue;
    }

    update = true;
    break;
  }

  // Space is too small to hold the keypair
  if (tries === constants.hashmap.maxTries)
    return false;

  if (!update)
    this._setCell(index * 2, key.ptr || key);
  this._setCell(index * 2 + 1, val.ptr || val);

  return true;
};

HashMap.prototype.get = function get(key) {
  var index;
  if (typeof key === 'number')
    index = utils.hashNumber(key) & this.mask();
  else
    index = key.hash() & this.mask();

  for (var tries = 0;
       tries < constants.hashmap.maxTries;
       tries++, index = (index + 1) & this.mask()) {

    var ptr = this._getCell(index * 2);
    if (typeof ptr === 'number') {
      if (typeof key !== 'number')
        continue;

      if (key !== ptr)
        continue;
    } else {
      if (this.heap.isHole(ptr))
        break;

      if (!key.isSame(ptr))
        continue;
    }

    var res = this._getCell(index * 2 + 1);
    return this.heap.get(res);
  }

  return null;
};

HashMap.prototype.iterate = function iterate(cb) {
  var size = this.size();

  for (var i = 0; i < size; i++) {
    var key = this._getCell(i * 2);
    if (typeof key === 'object' && this.heap.isHole(key))
      continue;

    cb(this.heap.get(key), this.heap.get(this._getCell(i * 2 + 1)));
  }
};
