var heap = require('../heap');
var constants = heap.constants;
var binding = heap.binding;
var utils = heap.utils;

function Scope(heap, size) {
  this.heap = heap;
  this.offset = 0;
  this.size = size || constants.scope.size;
  this.storage = new Buffer(this.size * binding.ptrSize);
}
module.exports = Scope;

Scope.prototype.enter = function enter() {
  this.heap.enterScope(this);
};

Scope.prototype.leave = function leave() {
  this.heap.leaveScope(this);
};

Scope.prototype.add = function add(ptr) {
  var off = this.offset++;
  binding.writeTagged(this.storage, ptr.ptr || ptr, off * heap.ptrSize);

  if (this.offset === this.size) {
    // Grow storage
    var tmp = new Buffer(this.storage.length * 2);
    this.storage.copy(tmp);
    this.storage = tmp;
  }

  return new Handle(this, off);
};

Scope.prototype.deref = function deref(index) {
  return binding.readTagged(this.storage, index * heap.ptrSize);
};

Scope.prototype.visit = function visit(cb) {
  for (var i = 0; i < this.offset; i++) {
    cb(this.storage, i * heap.ptrSize);
  }
};

function Handle(scope, index) {
  this.scope = scope;
  this.index = index;
}

Handle.prototype.deref = function deref() {
  return this.scope.deref(this.index);
};

Handle.prototype.isSame = function isSame(ptr, off) {
  return utils.cmpPtr(ptr, off, this.scope.storage, this.index * heap.ptrSize);
};
