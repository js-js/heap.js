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
  cb(ptr, 0, 'map');

  var handle = this.heap.wrap(ptr).cast();
  if (handle instanceof heap.entities.Object) {
    this.visitObject(handle, ptr, cb);
  } else if (handle instanceof heap.entities.HashMap) {
    this.visitHashmap(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Map) {
    this.visitMap(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Code) {
    this.visitCode(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Function) {
    this.visitFunction(handle, ptr, cb);
  }
};

Visitor.prototype.visitObject = function visitObject(obj, ptr, cb) {
  // Hashmap field
  cb(ptr, heap.ptrSize, 'hashmap');
};

Visitor.prototype.visitHashmap = function visitHashmap(hashmap, ptr, cb) {
  var size = 2 * hashmap.size();
  cb(ptr, heap.ptrSize, 'hashmap-size');
  for (var i = 0; i < size; i++)
    cb(ptr, (2 + i) * heap.ptrSize, 'hashmap-slot');
};

Visitor.prototype.visitMap = function visitMap(map, ptr, cb) {
  // Parent
  cb(ptr, heap.ptrSize, 'parent');
};

Visitor.prototype.visitCode = function visitCode(code, ptr, cb) {
  // Slots
  code.offsets().forEach(function(off) {
    cb(ptr, 2 * heap.ptrSize + off, 'code-slot');
  });
};

Visitor.prototype.visitFunction = function visitFunction(fn, ptr, cb) {
  // Code
  cb(ptr, heap.ptrSize, 'code');
};
