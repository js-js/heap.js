var heap = require('../heap');
var binding = heap.binding;
var constants = heap.constants;

var assert = require('assert');
var Buffer = require('buffer').Buffer;

function Page(type, blockSlice) {
  this.type = type;

  this.startRef = null;
  this.limitRef = null;

  this.data = blockSlice.allocChunk(type);
  this.size = this.data.length;

  // Reserve space for marking bits
  // [ marked:1 <generation counter>:3 ] for every pointer
  var bfSize = (constants.page.markingBits * this.size) /
               (heap.ptrSize * heap.ptrSize);
  if ((bfSize % heap.align) != 0)
    bfSize += bfSize - (bfSize % heap.align);
  this.bitfield = this.data.slice(0, bfSize);
  this.bitfield.fill(0);
}
module.exports = Page;

Page.prototype.init = function init(space) {
  if (this.startRef) {
    // NOTE: Contents are already swapped in space
    this.startRef = space.startRef;
    this.limitRef = space.limitRef;
  } else {
    this.startRef = space.startRef;
    this.limitRef = space.limitRef;

    binding.writeTagged(this.startRef,
                        this.data.slice(this.bitfield.length),
                        0);
    binding.writeTagged(this.limitRef, this.data.slice(this.size), 0);
  }
};

Page.prototype.alloc = function alloc(size) {
  return binding.pointerAdd(this.startRef, this.limitRef, size);
};
