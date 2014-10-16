var heap = require('../heap');
var constants = heap.constants;
var binding = heap.binding;

var assert = require('assert');
var Buffer = require('buffer').Buffer;

function VirtualScope(heap, size) {
  this.type = 'virtual';
  this.heap = heap;
  this.offset = 0;
  this.size = size || constants.scope.size;

  this.handles = [];
}
module.exports = VirtualScope;

VirtualScope.prototype.enter = function enter() {
  this.heap.enterScope(this);
};

VirtualScope.prototype.leave = function leave() {
  this.heap.leaveScope(this);
};

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

VirtualScope.prototype.visit = function visit(cb) {
};
