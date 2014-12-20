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
  undef: 1,
  null: 2
};
Oddball.kindByValue = {
  0: 'hole',
  1: 'undef',
  2: 'null'
};

Oddball.size = function size() {
  return this.super_.size() + 1;
};

Oddball.alloc = function alloc(heap, kind) {
  // Use cached oddball
  if (heap[kind])
    return heap[kind];
  if (kind === 'null' && heap.null_)
    return heap.null_;

  var res = heap.allocTagged('data', 'oddball', Oddball.size());
  res[offsets.kind] = Oddball.kind[kind];
  return new Oddball(heap, res);
};

Oddball.prototype.kind = function kind() {
  return Oddball.kindByValue[this.deref()[offsets.kind]];
};

Oddball.prototype.rawSize = function rawSize() {
  return Oddball.size();
};

Oddball.prototype.toJSON = function toJSON() {
  var kind = this.kind();

  if (kind === 'undef')
    return undefined;
  if (kind === 'null')
    return null;

  throw new Error('Converting ' + kind + ' to JSON');
};
