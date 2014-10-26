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
  var self = this;
  var heap = this.heap;
  var queue = [];

  this.space = space;

  // Populate roots
  this.heap.scopes.forEach(function(scope) {
    scope.visit(function(data, off) {
      if (typeof to !== 'number')
        queue.push(new Edge(self, data, off, scope.type));
    });
  });

  // Target of evacuation
  var ark = space.getSemi();

  // Visit and mark everything
  while (queue.length !== 0) {
    // The order is important, as we want to move maps first and the rest of
    // the stuff later
    var edge = queue.shift();

    if (this.isMarked(edge.to, edge.tag)) {
      this.relocate(edge);
      continue;
    }

    // Evacuate to the new space
    var dst;
    if (this.space === edge.space)
      dst = this.evacuate(edge, ark);
    else
      dst = null;

    this.setMark(edge, dst);

    // Queue all ancestors
    this.heap.visit(dst || edge.to, function(data, off, tag) {
      var subEdge = new Edge(self, data, off, tag);

      // Ignore cross-space edges
      if (subEdge.space !== space)
        return;

      // Just to keep queue length under control, and
      // update fields
      if (self.isMarked(subEdge.to, subEdge.tag)) {
        self.relocate(subEdge);
        return;
      }

      queue.push(subEdge);
    });
  }

  this.space.swapSemi();
  this.space = null;
};

MarkCopy.prototype.isMarked = function isMarked(ptr, tag) {
  if (typeof ptr === 'number')
    return true;

  var mark = binding.readMark(ptr,
                              constants.page.size,
                              constants.page.markingBits);
  mark >>= 3;
  return mark === 1;
};

MarkCopy.prototype.relocate = function relocate(edge) {
  if (edge.space !== this.space)
    return;
  if (typeof edge.to === 'number')
    return;

  // Read updated pointer
  var ptr = binding.readTagged(edge.to, 0);
  binding.writeTagged(edge.data, ptr, edge.offset);
};

MarkCopy.prototype.setMark = function setMark(edge, dst) {
  // Put the new address to a source slot
  if (edge.space === this.space)
    binding.writeTagged(edge.to, dst, 0);

  // Set mark
  var size = constants.page.size;
  var markingBits = constants.page.markingBits;
  var m = binding.readMark(edge.to, size, markingBits);

  // Increment age of the object
  m = (1 << 3) | Math.min((m & 0x7) + 1, 0x7);
  binding.writeMark(edge.to, m, size, markingBits);

  if (dst) {
    // Copy age of the object
    binding.writeMark(dst, m & 0x7, size, markingBits);

    // Set new pointer
    binding.writeTagged(edge.data, dst, edge.offset);
  }
};

MarkCopy.prototype.getMap = function getMap(ptr) {
  if (typeof ptr === 'number')
    return this.heap.maps.smi.deref();

  var off = heap.entities.Base.offsets.map;

  // Use updated map pointer if it was already moved
  var map = binding.readTagged(ptr, off);
  if (this.isMarked(map, 'map'))
    map = binding.readTagged(map, off);

  return map;
};

MarkCopy.prototype.evacuate = function evacuate(edge, target) {
  var obj = this.heap.wrap(edge.to);
  var map = this.heap.wrap(this.getMap(edge.to));
  obj = obj.cast(map);

  // Get size
  var size;
  if (obj === null)
    size = heap.ptrSize;
  else
    size = obj.rawSize();

  var res = target.allocRaw(size);
  edge.to.copy(res, 0, 0, size);
  return res;
};

function Edge(gc, data, offset, tag) {
  this.gc = gc;
  this.to = binding.readTagged(data, offset);
  this.data = data;
  this.offset = offset;
  this.tag = tag;

  this.space = this.gc.heap.getSpace(this.to, this.gc.getMap(this.to));
}
