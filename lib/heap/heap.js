var heap = require('../heap');
var Space = heap.Space;
var binding = heap.binding;

function Heap() {
  this.data = new Space('data', 1024 * 1024);
  this.code = new Space('code', 1024 * 1024);
}
module.exports = Heap;

Heap.create = function create() {
  return new Heap();
};

Heap.prototype.allocDouble = function allocDouble(val) {
  var res = this.data.allocTagged('double', 8);
  res.writeDoubleLE(val, 8, true);
  return new heap.entities.Double(res);
};

Heap.prototype.allocObject = function allocObject(size) {
  var res = this.data.allocTagged('object', 8);
  var hm = this.data.allocTagged('hashmap', (1 + size) * 8);

  // Hashmap size
  binding.writeTagged(hm, size, 8);

  // Hashmap contents (zero-fill them)
  hm.fill(0, 16);

  // Hashmap
  binding.writeTagged(res, hm, 8);

  return new heap.entities.Object(res);
};

Heap.prototype.get = function get(ptr) {
  var type = constants.typeByName[ptr.readUInt32LE(4, true)];

  if (type === 'double') {
    return new heap.entities.Double(ptr);
  } else if (type === 'object') {
    return new heap.entities.Object(ptr);
  } else {
    throw new Error('Unknown heap entity type ' + type);
  }
};
