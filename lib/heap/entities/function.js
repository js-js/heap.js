var heap = require('../../heap');
var binding = heap.binding;
var Object = heap.entities.Object;

var util = require('util');

function Function(heap, ptr) {
  Object.call(this, heap, ptr);
  this.type = 'function';
}
util.inherits(Function, Object);
module.exports = Function;

var offsets = {
  code: Object.size()
};
Function.offsets = offsets;

Function.size = function size() {
  return this.super_.size() + heap.ptrSize;
};

Function.prototype.code = function code() {
  return new heap.entities.Code(
      this.heap,
      binding.readTagged(this.deref(), offsets.code));
};

Function.prototype._setCode = function _setCode(code) {
  return binding.writeTagged(this.deref(), code.deref(), offsets.code);
};

Function.prototype.rawSize = function rawSize() {
  return Function.size();
};

Function.prototype.call = function call(self, args) {
  var code = this.code().code();
  var argv = (args || []).map(function(arg) {
    return arg.deref();
  });

  var ctx = this.heap.context;

  argv.unshift(ctx.deref());
  argv.unshift(self ? self.deref() : ctx.global().deref());
  if (this.heap.options.callWrapper) {
    argv.unshift(code);
    code = this.heap.options.callWrapper;
  }
  var res = binding.call(code, argv);
  return this.heap.wrap(res);
};

Function.prototype.toJSON = function toJSON() {
  return function __compiled_code__() {};
};
