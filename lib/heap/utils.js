var heap = require('../heap');
var binding = heap.binding;

var Buffer = require('buffer').Buffer;

function hash(data, start, end) {
  var hash = 0;

  for (var i = start; i < end; i++) {
    var c = data[i];

    hash = (hash + c) | 0;
    hash = (hash + (hash << 10)) | 0;
    hash ^= (hash >>> 6);
  }

  hash = (hash + (hash << 3)) | 0;
  hash = (hash + (hash >>> 11)) | 0;
  hash = (hash + (hash << 15)) | 0;

  return hash;
}
exports.hash = hash;

function hashNumber(num) {
  var hash = 0;

  while (num !== 0) {
    var c = num & 0xff;
    num = num >>> 8;

    hash = (hash + c) | 0;
    hash = (hash + (hash << 10)) | 0;
    hash ^= (hash >>> 6);
  }

  hash = (hash + (hash << 3)) | 0;
  hash = (hash + (hash >>> 11)) | 0;
  hash = (hash + (hash << 15)) | 0;

  return hash;
}
exports.hashNumber = hashNumber;

function cmpPtr(src, soff, dst, doff) {
  for (var i = 0; i < heap.ptrSize; i++)
    if (src[soff + i] !== dst[doff + i])
      return false;

  return true;
};
exports.cmpPtr = cmpPtr;

function getPointer(buf) {
  var ptr = new Buffer(heap.ptrSize);
  binding.writeTagged(ptr, buf, 0);
  return ptr;
};
exports.getPointer = getPointer;
