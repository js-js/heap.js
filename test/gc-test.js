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

        assert(h.gc());
        assert.equal(obj.get(h.allocString('key')).cast().toString(),
                     'alright');
      });
    });

    it('should collect code garbage', function() {
      h.scope(function(scope) {
        var buf = new Buffer(59);

        h.scope(function() {
          var obj = h.allocObject(4);
          obj.set(h.allocString('a'), obj);
          obj.set(h.allocString('b'), h.allocString('c'));
          obj.set(h.allocString('parent'), obj);

          heap.binding.writeTagged(buf, obj.deref(), heap.ptrSize);
        });
        var code = h.allocCode(buf, [ heap.ptrSize ]);

        assert(h.gc());
        var slot = code.readSlot(code.offsets()[0]);
        assert.equal(h.cast(slot).get(h.allocString('b')).cast().toString(),
                     'c');
      });
    });
  });
});
