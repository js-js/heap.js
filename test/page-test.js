var assert = require('assert');
var heap = require('../');
var BlockSlice = heap.BlockSlice;
var Page = heap.Page;

describe('Page', function() {
  describe('.alloc()', function() {
    it('should allocate bytes', function() {
      var b = new BlockSlice();
      var p = new Page('data', b);
      var buf = p.alloc(512);
      assert(buf);

      // Should not crash
      buf[0] = 123;

      // Should fail to allocate
      var buf = p.alloc(1024 * 1024);
      assert(!buf);
    });
  });
});
