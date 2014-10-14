var heap = require('../heap');
var constants = heap.constants;

var mmap = require('mmap.js');

function BlockSlice() {
  this.blocks = {
    data: null,
    code: null
  };
}
module.exports = BlockSlice;

BlockSlice.prototype.allocChunk = function allocChunk(type) {
  var btype = type === 'code' ? 'code' : 'data';
  if (this.blocks[btype] === null) {
    var prot = mmap.PROT_READ | mmap.PROT_WRITE;
    if (type === 'code')
      prot |= mmap.PROT_EXEC;

    this.blocks[btype] = mmap.alignedAlloc(
        constants.space.blockSize,
        prot,
        mmap.MAP_PRIVATE | mmap.MAP_ANON,
        -1,
        0,
        constants.page.size);
  }

  var block = this.blocks[btype];

  var res = block.slice(0, constants.page.size);
  if (block.length === res.length)
    this.blocks[btype] = null;
  else
    this.blocks[btype] = block.slice(res.length);

  return res;
};
