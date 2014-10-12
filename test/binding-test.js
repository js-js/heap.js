var assert = require('assert');
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
});
