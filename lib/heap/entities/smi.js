var heap = require('../../heap');
var Base = heap.entities.Base;

var util = require('util');

function Smi(heap, ptr) {
  Base.call(this, heap, 'smi', ptr);
}
util.inherits(Smi, Base);
module.exports = Smi;

Smi.offsets = {};

Smi.size = function size() {
  return this.super_.size();
};

Smi.prototype.value = function value() {
  return this.deref();
};

Smi.prototype.rawSize = function rawSize() {
  return Smi.size();;
};

Smi.prototype.hash = function hash() {
  return heap.utils.hashNumber(this.value());
};

Smi.prototype.toJSON = function toJSON() {
  return this.value();
};
