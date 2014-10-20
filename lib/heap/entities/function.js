var heap = require('../../heap');
var binding = heap.binding;
var Base = heap.entities.Base;

var util = require('util');

function Function(heap, ptr) {
  Base.call(this, heap, 'function', ptr);
}
util.inherits(Function, Base);
module.exports = Function;

var offsets = {
  code: heap.ptrSize
};
Function.offsets = offsets;

Function.prototype.code = function code() {
  return new heap.entities.Code(
      this.heap,
      binding.readTagged(this.deref(), offsets.code));
};

Function.prototype._rawSize = function _rawSize() {
  return heap.ptrSize;
};

Function.prototype.call = function call(self, args) {
  var code = this.code().code();
  var argv = args.map(function(arg) {
    return arg.deref();
  });

  var ctx = this.heap.context;
  if (self)
    ctx.updateSelf(self);
  else
    ctx.updateSelf(ctx.global());

  argv.unshift(ctx.deref());
  if (this.heap.options.callWrapper) {
    argv.unshift(code);
    code = this.heap.options.callWrapper;
  }
  var res = binding.call(code, argv);
  return this.heap.wrap(res);
};
