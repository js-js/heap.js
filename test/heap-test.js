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

  describe('.allocNumber()', function() {
    it('should allocate smi or double', function() {
      var d = h.allocNumber(123.456);
      assert.equal(d.type, 'double');
      assert.equal(d.value(), 123.456);

      var d = h.allocNumber(123);
      assert.equal(d.type, 'smi');
      assert.equal(d.value(), 123);

      var d = h.allocNumber(0xffffffff);
      assert.equal(d.type, 'double');
      assert.equal(d.value(), 0xffffffff);
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
      var o = h.allocObject();
      assert(o.field().size() > 0);
    });
  });

  describe('.allocCode()', function() {
    it('should allocate code', function() {
      var c = h.allocCode(new Buffer([ 1, 2, 3 ]), [ 0, 8, 16 ], [ 1, 2, 3 ]);
      assert.equal(c.size(), 3);
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

      assert(!c.global().isHole());
    });
  });

  describe('.fromJSON()', function() {
    it('should allocate complex object', function() {
      var obj = {
        a: 1,
        b: {
          c: null,
          d: undefined,
          e: 'hello'
        },
        c: 123.456
      };
      var c = h.fromJSON(obj);

      assert.deepEqual(c.toJSON(), obj);
    });
  });
});
