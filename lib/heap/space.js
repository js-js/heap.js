var heap = require('../heap');
var Page = heap.Page;
var constants = heap.constants;

var Buffer = require('buffer').Buffer;

function Space(h, type) {
  this.heap = h;
  this.type = type;

  this.startRef = new Buffer(heap.ptrSize);
  this.limitRef = new Buffer(heap.ptrSize);
  this.currentPage = null;

  var page = new Page(this.type, this.heap.blockSlice);
  this.setCurrent(page);
  this.total = this.currentPage.size;
  this.pages = [ this.currentPage ];

  this.semi = null;
}
module.exports = Space;

Space.prototype.setCurrent = function setCurrent(page) {
  this.currentPage = page;
  page.init(this);
};

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
  this.pages.push(page);
  this.total += page.size;

  return this.allocRaw(num);
};

Space.prototype.swapSemi = function swapSemi() {
  var semi = this.semi;

  var currentPage = semi.currentPage;
  var total = semi.total;
  var pages = semi.pages;
  this.setCurrent(semi.currentPage);
  this.total = semi.total;
  this.pages = semi.pages;
  semi.setCurrent(currentPage);
  semi.total = total;
  semi.pages = pages;
};
