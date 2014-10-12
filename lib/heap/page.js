var mmap = require('mmap.js');

function Page(type, size) {
  this.type = type;
  this.size = size;

  if ((this.size % mmap.PAGE_SIZE) !== 0)
    this.size += mmap.PAGE_SIZE - (this.size % mmap.PAGE_SIZE);

  var prot = mmap.PROT_READ | mmap.PROT_WRITE;
  if (type === 'code')
    prot |= mmap.PROT_EXEC;

  this.data = mmap.alloc(this.size,
                         prot,
                         mmap.MAP_PRIVATE | mmap.MAP_ANON,
                         -1,
                         0);
  this.offset = 0;
}
module.exports = Page;

Page.prototype.alloc = function alloc(size) {
  if (this.offset + size >= this.size)
    return false;

  this.offset += size;
  return this.data.slice(this.offset - size, this.offset);
};
