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

      // Get wrapper from pointer
      var d2 = h.get(d.ptr);
      assert(d2 instanceof heap.entities.Double);
      assert.equal(d2.value(), 123.456);
    });
  });

  describe('.allocString()', function() {
    it('should allocate string', function() {
      var s = h.allocString('hello world');
      assert.equal(s.length(), 11);
      assert.equal(s.toString(), 'hello world');
      assert.equal(s.hash(), 1590860647);

      // Get wrapper from pointer
      var s2 = h.get(s.ptr);
      assert(s2 instanceof heap.entities.String);
      assert.equal(s2.length(), 11);
      assert.equal(s2.toString(), 'hello world');
      assert.equal(s2.hash(), 1590860647);
    });
  });

  describe('.allocObject()', function() {
    it('should allocate object', function() {
      var o = h.allocObject(64);
      assert.equal(o.hashmap().size(), 64);

      // Get wrapper from pointer
      var o2 = h.get(o.ptr);
      assert(o2 instanceof heap.entities.Object);
      assert.equal(o2.hashmap().size(), 64);
    });
  });
});
