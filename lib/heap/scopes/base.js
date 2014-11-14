var heap = require('../heap');

function Base(heap, type) {
  this.heap = heap;
  this.type = type;
  this.weak = false;
}
module.exports = Base;

Base.prototype.enter = function enter() {
  this.heap.enterScope(this);
};

Base.prototype.leave = function leave() {
  this.heap.leaveScope(this);
};

Base.prototype.wrap = function wrap(body, self) {
  this.enter();
  var res = body.call(self);
  this.leave();
  return res;
};

Base.prototype.add = function add(ptr) {
  throw new Error('Not implemented');
};

Base.prototype.replace = function replace(ptr) {
  throw new Error('Not implemented');
};

Base.prototype.getPointer = function getPointer(index) {
  throw new Error('Not implemented');
};

Base.prototype.deref = function deref(index) {
  throw new Error('Not implemented');
};

Base.prototype.visit = function visit(cb, ctx) {
};
