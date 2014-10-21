var assert = require('assert');
var heap = require('../');

describe('Heap', function() {
  var h;
  beforeEach(function() {
    h = heap.create();
  });

  describe('.allocDouble()', function() {
    it('should allocate double', function() {
      var d = h.allocDouble(123.456);
      assert.equal(d.value(), 123.456);
    });
  });

  describe('.allocBoolean()', function() {
    it('should allocate boolean', function() {
      var d = h.allocBoolean(true);
      assert.equal(d.value(), true);

      var d = h.allocBoolean(false);
      assert.equal(d.value(), false);
    });
  });

  describe('.allocString()', function() {
    it('should allocate string', function() {
      var s = h.allocString('hello world');
      assert.equal(s.length(), 11);
      assert.equal(s.toString(), 'hello world');
      assert.equal(s.hash(), 1590860647);
    });
  });

  describe('.allocObject()', function() {
    it('should allocate object', function() {
      var o = h.allocObject(64);
      assert.equal(o.hashmap().size(), 64);
    });
  });

  describe('.allocCode()', function() {
    it('should allocate code', function() {
      var c = h.allocCode(new Buffer([ 1, 2, 3 ]), [ 0, 8, 16 ]);
      assert.equal(c.size(), heap.ptrSize);
    });
  });

  describe('.allocFunction()', function() {
    it('should allocate function', function() {
      var c = h.allocCode(new Buffer([ 1, 2, 3 ]), [ 0, 8, 16 ]);
      var fn = h.allocFunction(c);
      assert.equal(fn.code().ptr().toString('hex'), c.ptr().toString('hex'));
    });
  });

  describe('.allocContext()', function() {
    it('should allocate context', function() {
      var c = h.allocContext();

      assert(c.global().isSame(c.self()));
      assert(h.isHole(c.fn()));
    });
  });
});
