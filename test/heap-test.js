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

  describe('.allocObject()', function() {
    it('should allocate object', function() {
      var d = h.allocObject(100);
      assert.equal(d.hashmap().size(), 100);
    });
  });
});
