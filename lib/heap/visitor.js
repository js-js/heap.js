var heap = require('../heap');
var binding = heap.binding;

function Visitor(heap) {
  this.heap = heap;
}
module.exports = Visitor;

Visitor.prototype.visit = function visit(ptr, cb) {
  if (typeof ptr === 'number')
    return;

  // Visit map
  cb(ptr, 0);

  var map = binding.readTagged(ptr, 0);
  if (this.heap.maps.object.isSame(map)) {
    this.visitObject(ptr, cb);
  } else if (this.heap.maps.hashmap.isSame(map)) {
    this.visitHashmap(ptr, cb);
  }
};

Visitor.prototype.visitObject = function visitObject(ptr, cb) {
  // Hashmap field
  cb(ptr, heap.ptrSize);
};

Visitor.prototype.visitHashmap = function visitHashmap(ptr, cb) {
  var hashmap = new heap.entities.HashMap(this.heap, ptr);

  var size = 2 * hashmap.size();
  for (var i = 0; i < size; i++)
    cb(ptr, (1 + i) * heap.ptrSize);
};
