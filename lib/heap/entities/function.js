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
  instanceMap: Object.size() + heap.ptrSize,
  outer: Object.size() + 2 * heap.ptrSize,
  context: {
    size: Object.size() + 3 * heap.ptrSize,
    field: Object.size() + 4 * heap.ptrSize
  }
};
Function.offsets = offsets;

Function.size = function size(slots) {
  return this.super_.size() + (4 + slots) * heap.ptrSize;
};

Function.alloc = function alloc(h, code, outer, slots) {
  if (!outer)
    outer = h.hole;
  if (!slots)
    slots = 0;

  var Map = heap.entities.Map;
  var res = h._allocObject('function', Function.size(slots));

  var fn = new Function(h, res);
  fn._setCode(code);

  h.virtualScope(function() {
    var instanceMap = h.allocMap('object',
                                 Map.flags.object |
                                     Map.flags.transition);
    fn._setInstanceMap(instanceMap);
  }, h);

  // Parent
  binding.writeTagged(res, outer.deref(), offsets.outer);

  // Context
  binding.writeTagged(res, slots, offsets.context.size);
  var undef = h.undef.deref();
  for (var i = 0; i < slots; i++)
    binding.writeTagged(res, undef, offsets.context.field + i *  heap.ptrSize);

  h.runPendingGC();
  return fn;
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

Function.prototype.outer = function outer() {
  return this.heap.wrap(binding.readTagged(this.deref(), offsets.outer));
};

Function.prototype.contextSize = function contextSize() {
  return binding.readTagged(this.deref(), offsets.context.size);
};

Function.prototype.contextGet = function contextGet(index) {
  return this.heap.wrap(binding.readTagged(
      this.deref(), offsets.context.field + index * heap.ptrSize));
};

Function.prototype.contextSet = function contextSet(index, value) {
  binding.writeTagged(this.deref(),
                      value.deref(),
                      offsets.context.field + index * heap.ptrSize);
};

Function.prototype.rawSize = function rawSize(slots) {
  return Function.size(this.contextSize());
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

  // Outer
  cb(ptr, offsets.outer, 'outer');

  // Context
  cb(ptr, offsets.context.size, 'context-size');
  var size = this.contextSize();
  for (var i = 0; i < size; i++)
    cb(ptr, offsets.context.field + i * heap.ptrSize, 'context-slot');
};
