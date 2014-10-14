var heap = require('../heap');
var constants = heap.constants;
var binding = heap.binding;
var utils = heap.utils;

var Space = heap.Space;

function MarkCopy(heap) {
  this.heap = heap;
  this.space = null;
  this.bit = 0;
}
module.exports = MarkCopy;

MarkCopy.prototype.run = function run(space) {
  var heap = this.heap;
  var queue = [];

  this.bit = ~this.bit & 1;
  this.space = space;

  // Populate roots
  this.heap.scopes.forEach(function(scope) {
    scope.visit(function(data, off) {
      if (typeof to !== 'number')
        queue.push(new Edge(heap, data, off));
    });
  });

  // Target of evacuation
  var ark = {
    code: null,
    data: null
  };

  var spaces = this.heap.spaces;
  if (this.space === 'code')
    ark.code = new Space(this.heap, 'code', spaces.code.minSize);
  if (this.space === 'data')
    ark.data = new Space(this.heap, 'data', spaces.data.minSize);

  // Visit and mark everything
  var self = this;
  while (queue.length !== 0) {
    var edge = queue.pop();
    console.log('pop', utils.getPointer(edge.to));

    if (this.isMarked(edge))
      continue;

    // Queue all ancestors
    this.heap.visit(edge.to, function(data, off) {
      var edge = new Edge(heap, data, off);
      console.log('  ->', utils.getPointer(edge.to));

      // Just to keep queue length under control
      if (self.isMarked(edge))
        return;

      queue.push(edge);
    });

    // Evacuate to the new space
    var dst;
    if (this.space === edge.space)
      dst = this.evacuate(edge.to, ark[edge.space]);
    else
      dst = null;

    this.setMark(edge, dst);
  }

  if (ark.code)
    spaces.code = ark.code;
  if (ark.data)
    spaces.data = ark.data;
};

MarkCopy.prototype.isMarked = function isMarked(edge) {
  if (typeof edge.to === 'number')
    return true;

  var mark = binding.readMark(edge.to,
                              constants.page.size,
                              constants.page.markingBits);
  console.log('  mark', mark.toString(16));
  mark >>= 3;
  if (mark !== this.bit)
    return false;

  if (edge.space !== this.space)
    return true;

  // Read updated pointer
  var ptr = binding.readTagged(edge.to, 0);
  binding.writeTagged(edge.data, mark, edge.offset);
  console.log('  update', utils.getPointer(edge.data.slice(edge.offset)), utils.getPointer(ptr));

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
  m = (this.bit << 3) | Math.min((m & 0x7) + 1, 0x7);
  binding.writeMark(edge.to, m, size, markingBits);
};

MarkCopy.prototype.evacuate = function evacuate(ptr, target) {
  var obj = this.heap.cast(ptr);
  var size;

  // Hole
  if (obj === null)
    size = 8;
  else
    size = obj.rawSize();

  var res = target.allocRaw(size);
  ptr.copy(res, 0, 0, size);
  console.log('  evac', utils.getPointer(ptr), ' -> ', utils.getPointer(res));
  return res;
};

function Edge(heap, data, offset) {
  this.heap = heap;
  this.to = binding.readTagged(data, offset);
  this.data = data;
  this.offset = offset;

  if (typeof this.to === 'number')
    this.space = 'data';
  else
    this.space = this.heap._getSpace(this.to);
}
