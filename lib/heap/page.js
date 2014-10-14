var heap = require('../heap');
var constants = heap.constants;

var assert = require('assert');

function Page(type, blockSlice) {
  this.type = type;

  this.data = blockSlice.allocChunk(type);
  this.offset = 0;
  this.size = this.data.length;

  // Reserve space for marking bits
  // [ marked:1 <generation counter>:3 ] for every pointer
  this.bitfield = this.alloc((constants.page.markingBits * this.size) /
                             (heap.ptrSize * heap.ptrSize));
  this.bitfield.fill(0);

  this.alignOffset();
}
module.exports = Page;

Page.prototype.alloc = function alloc(size) {
  if (this.offset + size >= this.size)
    return false;

  var res = this.data.slice(this.offset, this.offset + size);
  this.offset += size;

  // Always align offset
  this.alignOffset();

  return res;
};

Page.prototype.alignOffset = function alignOffset() {
  var alignMask = heap.align - 1;
  if ((this.offset & alignMask) !== 0) {
    this.offset |= alignMask;
    this.offset++;
  }
};
