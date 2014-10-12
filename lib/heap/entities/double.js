var heap = require('../../heap');
var Base = heap.entities.Base;

var util = require('util');

function Double(ptr) {
  Base.call(this, 'double', ptr);
}
util.inherits(Double, Base);
module.exports = Double;

Double.prototype.value = function value() {
  return this.ptr.readDoubleLE(8, true);
};
