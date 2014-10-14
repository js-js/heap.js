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

  var handle = this.heap.cast(ptr);
  if (handle instanceof heap.entities.Object) {
    this.visitObject(handle, ptr, cb);
  } else if (handle instanceof heap.entities.HashMap) {
    this.visitHashmap(handle, ptr, cb);
  }
};

Visitor.prototype.visitObject = function visitObject(obj, ptr, cb) {
  // Hashmap field
  cb(ptr, heap.ptrSize);
};

Visitor.prototype.visitHashmap = function visitHashmap(hashmap, ptr, cb) {
  var size = 2 * hashmap.size();
  for (var i = 0; i < size; i++)
    cb(ptr, (1 + i) * heap.ptrSize);
};
