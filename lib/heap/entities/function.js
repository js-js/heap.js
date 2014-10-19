var heap = require('../../heap');
var binding = heap.binding;
var Base = heap.entities.Base;

var util = require('util');

function Function(heap, ptr) {
  Base.call(this, heap, 'function', ptr);
}
util.inherits(Function, Base);
module.exports = Function;

Function.prototype.code = function code() {
  return new heap.entities.Code(this.heap,
                                binding.readTagged(this.deref(), heap.ptrSize));
};

Function.prototype._rawSize = function _rawSize() {
  return heap.ptrSize;
};

Function.prototype.call = function call(args) {
  return this.heap.wrap(binding.call(this.code().code(),
                                     args.map(function(arg) {
                                       return arg.deref();
                                     })));
};
