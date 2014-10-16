var heap = require('../heap');
var Page = heap.Page;
var constants = heap.constants;

function Space(heap, type) {
  this.heap = heap;
  this.type = type;
  this.currentPage = new Page(this.type, this.heap.blockSlice);
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
  var page = new Page(this.type, this.heap.blockSlice);
  this.currentPage = page;
  this.pages.push(page);
  this.total += page.size;

  return this.allocRaw(num);
};

Space.prototype.replaceWith = function replaceWith(other) {
  this.currentPage = other.currentPage;
  this.total = other.total;
  this.pages = other.pages;
  this.bit = other.bit;
};
