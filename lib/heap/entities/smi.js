var heap = require('../../heap');
var Base = heap.entities.Base;

var util = require('util');

function Smi(heap, ptr) {
  Base.call(this, heap, 'smi', ptr);
}
util.inherits(Smi, Base);
module.exports = Smi;

Smi.prototype.value = function value() {
  return this.deref();
};

Smi.prototype._rawSize = function _rawSize() {
  return 0;
};

Smi.prototype.hash = function hash() {
  return heap.utils.hashNumber(this.value());
};
