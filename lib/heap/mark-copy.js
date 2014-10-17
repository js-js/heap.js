var heap = require('../heap');
var constants = heap.constants;
var binding = heap.binding;
var utils = heap.utils;

var Space = heap.Space;

function MarkCopy(heap) {
  this.heap = heap;
  this.space = null;
}
module.exports = MarkCopy;

MarkCopy.prototype.run = function run(space) {
  var heap = this.heap;
  var queue = [];

  this.space = space;

  // Populate roots
  this.heap.scopes.forEach(function(scope) {
    scope.visit(function(data, off) {
      if (typeof to !== 'number')
        queue.push(new Edge(heap, data, off));
    });
  });

  // Target of evacuation
  var ark = space.getSemi();

  // Visit and mark everything
  var self = this;
  while (queue.length !== 0) {
    var edge = queue.pop();

    if (this.isMarked(edge))
      continue;

    // Queue all ancestors
    this.heap.visit(edge.to, function(data, off) {
      var edge = new Edge(heap, data, off);

      // Ignore cross-space edges
      if (edge.space !== space)
        return;

      // Just to keep queue length under control
      if (self.isMarked(edge))
        return;

      queue.push(edge);
    });

    // Evacuate to the new space
    var dst;
    if (this.space === edge.space)
      dst = this.evacuate(edge.to, ark);
    else
      dst = null;

    this.setMark(edge, dst);
  }

  this.space.swapSemi();
};

MarkCopy.prototype.isMarked = function isMarked(edge) {
  if (typeof edge.to === 'number')
    return true;

  var mark = binding.readMark(edge.to,
                              constants.page.size,
                              constants.page.markingBits);
  mark >>= 3;
  if (mark !== 1)
    return false;

  if (edge.space !== this.space)
    return true;

  // Read updated pointer
  var ptr = binding.readTagged(edge.to, 0);
  binding.writeTagged(edge.data, ptr, edge.offset);

  return true;
};

MarkCopy.prototype.setMark = function setMark(edge, dst) {
  // Update source slot
  if (edge.space === this.space)
    binding.writeTagged(edge.data, dst, edge.offset);

  // Set mark
  var size = constants.page.size;
  var markingBits = constants.page.markingBits;
  var m = binding.readMark(edge.to, size, markingBits);

  // Increment age of the object
  m = (1 << 3) | Math.min((m & 0x7) + 1, 0x7);
  binding.writeMark(edge.to, m, size, markingBits);

  // Copy age of the object
  if (dst)
    binding.writeMark(dst, m & 0x7, size, markingBits);
};

MarkCopy.prototype.evacuate = function evacuate(ptr, target) {
  var obj = this.heap.wrap(ptr).cast();
  var size;

  // Hole
  if (obj === null)
    size = heap.ptrSize;
  else
    size = obj.rawSize();

  var res = target.allocRaw(size);
  ptr.copy(res, 0, 0, size);
  return res;
};

function Edge(heap, data, offset) {
  this.heap = heap;
  this.to = binding.readTagged(data, offset);
  this.data = data;
  this.offset = offset;

  this.space = this.heap.getSpace(this.to);
}
