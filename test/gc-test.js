var assert = require('assert');
var heap = require('../');

describe('GC', function() {
  var h;
  beforeEach(function() {
    h = heap.create();
  });

  describe('heap.gc()', function() {
    it('should collect garbage', function() {
      h.scope(function(scope) {
        var obj = h.allocObject(32);

        var old = h.allocObject(4);
        old.set(h.allocString('a'), old);
        old.set(h.allocString('b'), h.allocString('c'));
        old.set(h.allocString('parent'), obj);

        obj.set(h.allocString('key'), old);
        obj.set(h.allocString('key'), h.allocString('alright'));

        h.gc();
      });
    });
  });
});
