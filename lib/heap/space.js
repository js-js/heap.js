var heap = require('../heap');
var Page = heap.Page;
var constants = heap.constants;

function Space(heap, type, minSize) {
  this.heap = heap;
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
  this.heap.gc(this.type);

  // Retry after gc
  var res = this.currentPage.alloc(num);
  if (res)
    return res;

  // Grow
  var page = new Page(this.type, Math.max(num, this.minSize));
  this.currentPage = page;
  this.pages.push(page);
  this.total += page.size;

  return this.allocRaw(num);
};
