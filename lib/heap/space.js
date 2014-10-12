var heap = require('../heap');
var Page = heap.Page;
var constants = heap.constants;

function Space(type, minSize) {
  this.type = type;
  this.minSize = minSize;
  this.currentPage = new Page(this.type, this.minSize);
  this.total = this.currentPage.size;
  this.pages = [ this.currentPage ];
}
module.exports = Space;

Space.prototype.allocRaw = function allocRaw(num) {
  var res = this.currentPage.alloc(num);
  if (res)
    return res;

  // Allocation failure
  var page = new Page(this.type, Math.max(num, this.minSize));
  this.currentPage = page;
  this.pages.push(page);
  this.total += page.size;

  return this.alloc(num);
};

Space.prototype.allocTagged = function allogTagged(type, size) {
  var res = this.allocRaw(8 + size);

  // GC tag
  res.writeUInt32LE(0, 0, true);
  res.writeUInt32LE(constants.type[type], 4, true);

  return res;
};
