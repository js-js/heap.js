var heap = require('../../heap');
var Base = heap.entities.Base;

var util = require('util');

function Oddball(heap, ptr) {
  Base.call(this, heap, 'oddball', ptr);
}
util.inherits(Oddball, Base);
module.exports = Oddball;

var offsets = {
  kind: heap.ptrSize
};
Oddball.offsets = offsets;

Oddball.kind = {
  hole: 0,
  undef: 1
};
Oddball.kindByValue = {
  0: 'hole',
  1: 'undef'
};

Oddball.size = function size() {
  return this.super_.size() + 1;
};

Oddball.prototype.kind = function kind() {
  return Oddball.kindByValue[this.deref()[offsets.kind]];
};

Oddball.prototype.rawSize = function rawSize() {
  return Oddball.size();
};
