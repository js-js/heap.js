var assert = require('assert');
var heap = require('../');
var jit = require('jit.js');

describe('Binary', function() {
  var h;
  beforeEach(function() {
    h = heap.create();
  });

  describe('addition', function() {
    it('should work with smis', function() {
      var left = h.smi(123000);
      var right = h.smi(456);
      assert.equal(left.add(right).value(), 123456);
    });

    it('should work with doubles', function() {
      var left = h.allocDouble(1200.0078);
      var right = h.allocDouble(34.56);
      assert.equal(left.add(right).value(), 1234.5678);
    });

    it('should work with strings', function() {
      var left = h.allocString('hello ');
      var right = h.allocString('world!');
      assert.equal(left.add(right).value(), 'hello world!');
    });

    it('should work with number/string', function() {
      var left = h.smi(123);
      var right = h.allocString('ok');
      assert.equal(left.add(right).value(), '123ok');
    });
  });
});
