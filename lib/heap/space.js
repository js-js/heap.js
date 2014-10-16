var heap = require('../heap');
var Page = heap.Page;
var constants = heap.constants;

function Space(heap, type) {
  this.heap = heap;
  this.type = type;
  this.currentPage = new Page(this.type, this.heap.blockSlice);
  this.total = this.currentPage.size;
  this.pages = [ this.currentPage ];

  this.semi = null;
}
module.exports = Space;

Space.prototype.getSemi = function getSemi() {
  if (this.semi === null) {
    this.semi = new Space(this.heap, this.type);
    this.semi.semi = this;
  }
  return this.semi;
};

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

Space.prototype.swapSemi = function swapSemi() {
  var semi = this.semi;

  var currentPage = semi.currentPage;
  var total = semi.total;
  var pages = semi.pages;
  this.currentPage = semi.currentPage;
  this.total = semi.total;
  this.pages = semi.pages;
  semi.currentPage = currentPage;
  semi.total = total;
  semi.pages = pages;
};
