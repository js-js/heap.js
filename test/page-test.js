var assert = require('assert');
var heap = require('../');
var Page = heap.Page;

describe('Page', function() {
  describe('.alloc()', function() {
    it('should allocate bytes', function() {
      var p = new Page('data', 1024);
      var buf = p.alloc(512);
      assert(buf);

      // Should not crash
      buf[0] = 123;

      // Should fail to allocate
      var buf = p.alloc(100 * 1024);
      assert(!buf);
    });
  });
});
