var heap = require('../../heap');
var Base = heap.entities.Base;
var binding = heap.binding;

var util = require('util');

function Context(heap, ptr) {
  Base.call(this, heap, 'object', ptr);
}
util.inherits(Context, Base);
module.exports = Context;

Context.prototype._rawSize = function _rawSize() {
  return 3 * heap.ptrSize;
};

Context.prototype.self = function self() {
  return this.heap.wrap(binding.readTagged(this.deref(), heap.ptrSize));
};

Context.prototype.global = function global() {
  return this.heap.wrap(binding.readTagged(this.deref(), 2 * heap.ptrSize));
};

Context.prototype.fn = function fn() {
  return this.heap.wrap(binding.readTagged(this.deref(), 3 * heap.ptrSize));
};
