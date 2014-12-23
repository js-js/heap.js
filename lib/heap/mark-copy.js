var heap = require('../heap');
var constants = heap.constants;
var binding = heap.binding;
var utils = heap.utils;

var assert = require('assert');

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
  var weakQueue = [];
  this.heap.scopes.forEach(function(scope) {
    scope.visit(function visitScope(data, off) {
      var edge = new Edge(self, data, off, scope.type);
      if (scope.weak)
        weakQueue.push(edge);
      else
        queue.push(edge);
    });
  });

  // Target of evacuation
  var ark = space.getSemi();

  // Visit and mark everything
  var externalMarked = [];
  while (queue.length !== 0) {
    // The order is important, as we want to move maps first and the rest of
    // the stuff later
    var edge = queue.shift();

    if (this.isMarked(edge.space, edge.to, edge.tag)) {
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
    if (edge.space !== space)
      externalMarked.push(edge);

    // Queue all ancestors
    this.visit(dst || edge.to, visitSubEdge);
  }
  function visitSubEdge(data, off, tag, weak) {
    var subEdge = new Edge(self, data, off, tag);
    if (weak)
      return weakQueue.push(subEdge);

    // Ignore cross-space edges
    if (subEdge.space !== space)
      return;

    // Just to keep queue length under control, and
    // update fields
    if (self.isMarked(subEdge.space, subEdge.to, subEdge.tag)) {
      self.relocate(subEdge);
      return;
    }

    queue.push(subEdge);
  }

  // Visit handles in weak scopes, replace them with holes if they are not
  // marked
  weakQueue.forEach(function(edge) {
    if (this.isMarked(edge.space, edge.to, edge.tag))
      this.relocate(edge);
    else
      edge.update(this.heap.hole.deref());
  }, this);

  externalMarked.forEach(function(edge) {
    this.resetMark(edge);
  }, this);

  this.space.swapSemi();
  this.space = null;
};

MarkCopy.prototype.visit = function visit(ptr, cb) {
  if (typeof ptr === 'number')
    return;

  // Visit map
  cb(ptr, 0, 'map');

  var item = this.heap.wrap(ptr).cast();
  item.visit(cb, ptr);
};

MarkCopy.prototype.isMarked = function isMarked(space, ptr, tag) {
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
  edge.update(ptr);
};

MarkCopy.prototype.setMark = function setMark(edge, dst) {
  // Put the new address to a source slot
  if (edge.space === this.space)
    binding.writeTagged(edge.to, dst, 0);

  // Set mark
  var size = constants.page.size;
  var markingBits = constants.page.markingBits;
  var m = binding.readMark(edge.to, size, markingBits);

  binding.writeMark(edge.to, m | constants.page.markingBit, size, markingBits);

  if (dst) {
    // Copy age of the object
    binding.writeMark(dst, m & 0x7, size, markingBits);

    // Set new pointer
    edge.update(dst);
  }
};

MarkCopy.prototype.resetMark = function resetMark(edge) {
  // Should not reset mark
  if (edge.space === this.space)
    return;

  // Set mark
  var size = constants.page.size;
  var markingBits = constants.page.markingBits;
  var m = binding.readMark(edge.to, size, markingBits);

  binding.writeMark(edge.to, m & ~constants.page.markingBit, size, markingBits);
};

MarkCopy.prototype.getMap = function getMap(ptr) {
  if (typeof ptr === 'number')
    return this.heap.maps.smi.deref();

  var off = heap.entities.Base.offsets.map;

  // Use updated map pointer if it was already moved
  var map = binding.readTagged(ptr, off);
  assert.equal(typeof map, 'object');
  assert(Buffer.isBuffer(map));
  if (this.isMarked(this.heap.spaces.data, map, 'map'))
    map = binding.readTagged(map, off);

  return map;
};

MarkCopy.prototype.evacuate = function evacuate(edge, target) {
  var obj = this.heap.wrap(edge.to);
  var map = new heap.entities.Map(this.heap, this.getMap(edge.to));
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
  this.data = data;
  this.tag = tag;

  if (Array.isArray(offset)) {
    this.offset = offset[0];
    this.interior = offset[1];
    this.to = binding.readInterior(this.data, this.offset, this.interior);
  } else {
    this.offset = offset;
    this.interior = 0;
    this.to = binding.readTagged(this.data, this.offset);
  }

  this.space = this.gc.heap.getSpace(this.to, this.gc.getMap(this.to));
}


Edge.prototype.update = function update(ptr) {
  if (this.interior === 0)
    binding.writeTagged(this.data, ptr, this.offset);
  else
    binding.writeInterior(this.data, ptr, this.offset, this.interior);
};
