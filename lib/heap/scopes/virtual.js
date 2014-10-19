var heap = require('../../heap');
var constants = heap.constants;
var binding = heap.binding;
var Base = heap.scopes.Base;

var assert = require('assert');
var util = require('util');
var Buffer = require('buffer').Buffer;

function VirtualScope(heap, size) {
  Base.call(this, heap, 'virtual');
  this.handles = [];
}
util.inherits(VirtualScope, Base);
module.exports = VirtualScope;

VirtualScope.prototype.add = function add(ptr) {
  return this.handles.push(ptr) - 1;
};

VirtualScope.prototype.getPointer = function getPointer(index) {
  var ptr = new Buffer(heap.ptrSize);
  binding.writeTagged(ptr, this.deref(index), 0);
  return ptr;
};

VirtualScope.prototype.deref = function deref(index) {
  return this.handles[index];
};
