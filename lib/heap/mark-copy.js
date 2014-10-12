var heap = require('../heap');
var binding = heap.binding;
var Space = heap.Space;

function MarkCopy(heap) {
  this.heap = heap;
}
module.exports = MarkCopy;

MarkCopy.prototype.run = function run(space) {
  var queue = [];

  // Populate roots
  this.heap.scopes.forEach(function(scope) {
    scope.visit(function(data, off) {
      if (typeof to !== 'number')
        queue.push(new Edge(data, off));
    });
  });

  // Target of evacuation
  var ark = {
    code: null,
    data: null
  };
  if (space === 'code' || space === 'all')
    ark.code = new Space(this.heap, 'code', this.heap.code.minSize);
  if (space === 'data' || space === 'all')
    ark.data = new Space(this.heap, 'data', this.heap.data.minSize);

  // Visit and mark everything
  var self = this;
  while (queue.length !== 0) {
    var edge = queue.pop();
    var pspace = this.heap.getSpace(edge.to);

    if (space === 'all' || pspace === space) {
      if (this.isMarked(edge))
        continue;
    }

    // Queue all ancestors
    this.heap.visit(edge.to, function(data, off) {
      var edge = new Edge(data, off);

      // Just to keep queue length under control
      if (self.isMarked(edge))
        return;

      queue.push(edge);
    });

    if (space === 'all' || pspace === space) {
      // Evacuate to the new space
      var dst = this.evacuate(edge.to, ark[pspace]);

      // Update source slot
      // TODO(indutny): Pass offset here
      binding.writeTagged(edge.data, dst, edge.offset);

      // Skip already marked and mark others
      binding.mark(edge.to, dst);
    }
  }

  if (ark.code)
    this.heap.code = ark.code;
  if (ark.data)
    this.heap.data = ark.data;
};

MarkCopy.prototype.isMarked = function isMarked(edge) {
  var mark = binding.hasMark(edge.to);
  if (!mark)
    return false;

  binding.writeTagged(edge.data, mark, edge.offset);

  return true;
};

MarkCopy.prototype.evacuate = function evacuate(ptr, target) {
  // Update map, if needed
  // TODO(indutny): should not be needed if maps are not moving
  this.isMarked(new Edge(ptr, 0));

  var obj = this.heap.get(ptr);
  var size;

  // Hole
  if (obj === null)
    size = 8;
  else
    size = obj.rawSize();

  var res = target.allocRaw(size);
  ptr.copy(res, 0, 0, size);
  return res;
};

function Edge(data, offset) {
  this.to = binding.readTagged(data, offset);
  this.data = data;
  this.offset = offset;
}
