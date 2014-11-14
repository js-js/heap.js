var assert = require('assert');
var heap = require('../');

describe('GC', function() {
  var h;
  beforeEach(function() {
    h = heap.create();
  });

  describe('heap.gc()', function() {
    it('should collect garbage', function() {
      h.scope(function() {
        var obj = h.scope(function() {
          var obj = h.allocObject(32);

          var old = h.allocObject(4);
          old.set(h.allocString('a'), old);
          old.set(h.allocString('b'), h.allocString('c'));
          old.set(h.allocString('parent'), obj);

          obj.set(h.allocString('key'), old);
          var key = h.allocString('key');
          obj.set(key, h.allocString('alright'));

          return obj;
        });

        assert(h.gc());
        assert.equal(obj.get(h.allocString('key')).cast().toString(),
                     'alright');
      });
    });

    it('should collect code garbage', function() {
      h.scope(function() {
        var buf = new Buffer(59);

        var code = h.scope(function() {
          var obj = h.allocObject(4);
          obj.set(h.allocString('a'), obj);
          var c = h.allocString('c');
          obj.set(h.allocString('b'), c);
          obj.set(h.allocString('parent'), obj);

          var dead = h.allocObject();
          heap.binding.writeTagged(buf, obj.deref(), heap.ptrSize);
          heap.binding.writeTagged(buf, obj.deref(), 2 * heap.ptrSize);
          heap.binding.writeTagged(buf, dead.deref(), 3 * heap.ptrSize);

          return h.allocCode(buf, [
            heap.ptrSize
          ], [
            2 * heap.ptrSize,
            3 * heap.ptrSize
          ]);
        });

        assert(h.gc());
        assert(h.gc());
        var slot = code.readSlot(code.offsets()[0]).cast();
        var val = slot.get(h.allocString('b'));
        assert.equal(val.cast().toString(), 'c');

        var other = code.readSlot(code.weakOffsets()[0]).cast();
        assert(other.isSame(slot));

        var other = code.readSlot(code.weakOffsets()[1]).cast();
        assert(other.isHole());
      });
    });

    it('should collect string garbage', function() {
      h.scope(function() {
        var s = h.allocString('okay');

        assert(h.gc());
        s.hash();
      });
    });

    it('should hole-fy weak references', function() {
      var weak = h.createScope();
      weak.weaken();
      weak.enter();

      h.scope(function() {
        var dead;
        var alive = h.scope(function() {
          dead = h.allocObject();
          dead.move(weak);

          return h.allocObject();
        });

        alive = alive.copy(weak);

        assert(h.gc());
        assert(dead.isHole());
        assert(!alive.isHole());
      });
    });
  });
});
