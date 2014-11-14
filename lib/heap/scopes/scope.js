var heap = require('../../heap');
var constants = heap.constants;
var binding = heap.binding;
var Base = heap.scopes.Base;

var assert = require('assert');
var util = require('util');

function Scope(heap, size) {
  Base.call(this, heap, 'normal');
  this.offset = 0;
  this.size = size || constants.scope.size;

  // TODO(indutny): use free-list
  this.storage = new Buffer(this.size * binding.ptrSize);
}
util.inherits(Scope, Base);
module.exports = Scope;

Scope.prototype.weaken = function weaken() {
  this.weak = true;
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

Scope.prototype.replace = function replace(index, ptr) {
  binding.writeTagged(this.storage, ptr, index * heap.ptrSize);
};

Scope.prototype.getPointer = function getPointer(index) {
  var off = index * heap.ptrSize;
  return this.storage.slice(off, off + heap.ptrSize);
};

Scope.prototype.deref = function deref(index) {
  return binding.readTagged(this.storage, index * heap.ptrSize);
};

Scope.prototype.visit = function visit(cb, ctx) {
  for (var i = 0; i < this.offset; i++)
    cb.call(ctx, this.storage, i * heap.ptrSize);
};
