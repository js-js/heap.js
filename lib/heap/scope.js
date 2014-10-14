var heap = require('../heap');
var constants = heap.constants;
var binding = heap.binding;

var assert = require('assert');

function Scope(heap, size) {
  this.heap = heap;
  this.offset = 0;
  this.size = size || constants.scope.size;

  // TODO(indutny): use free-list
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
  binding.writeTagged(this.storage, ptr, off * heap.ptrSize);

  if (this.offset === this.size) {
    // Grow storage
    var tmp = new Buffer(this.storage.length * 2);
    this.storage.copy(tmp);
    this.storage = tmp;
    this.size *= 2;
  }

  return off;
};

Scope.prototype.getPointer = function getPointer(index) {
  var off = index * heap.ptrSize;
  return this.storage.slice(off, off + heap.ptrSize);
};

Scope.prototype.deref = function deref(index) {
  return binding.readTagged(this.storage, index * heap.ptrSize);
};

Scope.prototype.visit = function visit(cb) {
  for (var i = 0; i < this.offset; i++) {
    cb(this.storage, i * heap.ptrSize);
  }
};
