var heap = require('../../heap');
var binding = heap.binding;
var Object = heap.entities.Object;
var Code = heap.entities.Code;

var util = require('util');

function Function(heap, ptr) {
  Object.call(this, heap, ptr);
  this.type = 'function';
}
util.inherits(Function, Object);
module.exports = Function;

var offsets = {
  code: Object.size(),
  instanceMap: Object.size() + heap.ptrSize
};
Function.offsets = offsets;

Function.size = function size() {
  return this.super_.size() + 2 * heap.ptrSize;
};

Function.alloc = function alloc(h, code) {
  var Map = heap.entities.Map;
  var res = h._allocObject('function', Function.size());

  res = new Function(h, res);
  res._setCode(code);

  h.virtualScope(function() {
    var instanceMap = h.allocMap('object',
                                 Map.flags.object |
                                     Map.flags.transition);
    res._setInstanceMap(instanceMap);
  }, h);

  h.runPendingGC();
  return res;
};

Function.prototype.code = function code() {
  return new heap.entities.Code(
      this.heap,
      binding.readInterior(this.deref(), offsets.code, Code.offsets.code));
};

Function.prototype._setCode = function _setCode(code) {
  return binding.writeInterior(
      this.deref(), code.deref(), offsets.code, Code.offsets.code);
};

Function.prototype.instanceMap = function instanceMap() {
  return new heap.entities.Map(
      this.heap,
      binding.readTagged(this.deref(), offsets.instanceMap));
};

Function.prototype._setInstanceMap = function _setInstanceMap(map) {
  return binding.writeTagged(this.deref(), map.deref(), offsets.instanceMap);
};

Function.prototype.rawSize = function rawSize() {
  return Function.size();
};

Function.prototype.call = function call(self, args) {
  var state = this.heap.state;
  if (!self)
    self = state.global();
  self = self;

  var res;
  // Someone is willing to call it for us!
  if (this.heap.options.callWrapper) {
    res = this.heap.options.callWrapper(this, state, self, args || []);
  } else {
    var argv = (args || []).map(function(arg) {
      return arg.deref();
    });

    res = binding.call(this.code().code(),
                       [ self.deref(), state.deref() ].concat(argv));
  }

  return this.heap.wrap(res);
};

Function.prototype.toJSON = function toJSON() {
  return function __compiled_code__() {};
};

Function.prototype.visit = function visit(cb, ptr) {
  if (!ptr)
    ptr = this.ptr();
  Function.super_.prototype.visit.call(this, cb, ptr);

  // Code's code
  cb(ptr, [ offsets.code, Code.offsets.code ], 'code');

  // Instance map
  cb(ptr, offsets.instanceMap, 'instance-map');
};
