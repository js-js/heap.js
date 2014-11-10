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
  } else if (handle instanceof heap.entities.Field) {
    this.visitField(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Map) {
    this.visitMap(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Code) {
    this.visitCode(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Function) {
    this.visitFunction(handle, ptr, cb);
  } else if (handle instanceof heap.entities.Context) {
    this.visitContext(handle, ptr, cb);
  } else if (handle instanceof heap.entities.String) {
    this.visitString(handle, ptr, cb);
  }
};

Visitor.prototype.visitObject = function visitObject(obj, ptr, cb) {
  var Object = heap.entities.Object;

  // Field
  cb(ptr, Object.offsets.field, 'field');
};

Visitor.prototype.visitField = function visitField(field, ptr, cb) {
  var Field = heap.entities.Field;
  var size = field.size();
  cb(ptr, Field.offsets.size, 'field-size');
  for (var i = 0; i < size; i++)
    cb(ptr, Field.offsets.field + i * heap.ptrSize, 'field-slot');
};

Visitor.prototype.visitMap = function visitMap(map, ptr, cb) {
  var Map = heap.entities.Map;
  // Parent
  cb(ptr, Map.offsets.parent, 'parent');
  // Prototype
  cb(ptr, Map.offsets.proto, 'prototype');
  // Edges
  cb(ptr, Map.offsets.edges, 'edges');
};

Visitor.prototype.visitCode = function visitCode(code, ptr, cb) {
  var Code = heap.entities.Code;
  // Slots
  code.offsets().forEach(function(off) {
    cb(ptr, Code.offsets.code + off, 'code-slot');
  });
};

Visitor.prototype.visitFunction = function visitFunction(fn, ptr, cb) {
  var Function = heap.entities.Function;
  // Code
  cb(ptr, Function.offsets.code, 'code');
};

Visitor.prototype.visitContext = function visitContext(ctx, ptr, cb) {
  var Context = heap.entities.Context;
  cb(ptr, Context.offsets.global, 'global');
};

Visitor.prototype.visitString = function visitString(str, ptr, cb) {
  var String = heap.entities.String;
  cb(ptr, String.offsets.hash, 'hash');
};
