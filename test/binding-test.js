var assert = require('assert');
var mmap = require('mmap.js');
var heap = require('../');
var binding = heap.binding;

describe('binding', function() {
  describe('writeTagged', function() {
    it('should write pointers', function() {
      var dst = new Buffer(16);
      var src = new Buffer('hello world');

      binding.writeTagged(dst, src, 0);

      var res = binding.readTagged(dst, 0);
      assert(Buffer.isBuffer(res));
      assert.equal(res.slice(0, src.length).toString(),
                   src.toString());
    });

    it('should write numbers', function() {
      var dst = new Buffer(16);
      var src = 13589;

      binding.writeTagged(dst, src, 0);

      var res = binding.readTagged(dst, 0);
      assert(typeof res === 'number');
      assert.equal(res, src);
    });
  });

  describe('readMark()/.writeMark()', function() {
    it('should write/read mark', function() {
      var size = 1024 * 1024;
      var prot = mmap.PROT_READ | mmap.PROT_WRITE;
      var flags = mmap.MAP_SHARED | mmap.MAP_ANON;

      var page = mmap.alignedAlloc(size, prot, flags, -1, 0, size);
      var bitfield = page.slice(0, page.length / 16);
      var data = page.slice(bitfield.length);

      var a = data.slice(0);
      var b = data.slice(heap.ptrSize);
      var c = data.slice(2 * heap.ptrSize);

      binding.writeMark(a, 1, size, 4);
      binding.writeMark(b, 3, size, 4);
      binding.writeMark(c, 7, size, 4);
      assert.equal(binding.readMark(a, size, 4), 1);
      assert.equal(binding.readMark(b, size, 4), 3);
      assert.equal(binding.readMark(c, size, 4), 7);
    });
  });
});
