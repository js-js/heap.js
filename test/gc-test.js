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

        h.scope(function(scope) {
          var old = h.allocObject(4);
          old.set(h.allocString('a'), old);
          old.set(h.allocString('b'), h.allocString('c'));
          old.set(h.allocString('parent'), obj);

          obj.set(h.allocString('key'), old);
          var key = h.allocString('key');
          obj.set(key, h.allocString('alright'));
        });

        h.scope(function() {
          console.log('object:', obj.ptr().toString('hex'));
          console.log('hashmap:', obj.hashmap().ptr().toString('hex'));
        });
        h.gc();
        console.log(obj.get(h.allocString('key')).toString());
      });
    });
  });
});
