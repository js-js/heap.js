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
});
