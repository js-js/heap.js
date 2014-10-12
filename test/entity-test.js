var assert = require('assert');
var heap = require('../');

describe('Entities', function() {
  var h;
  beforeEach(function() {
    h = heap.create();
  });

  describe('String', function() {
    describe('.isSame()', function() {
      it('should return true on the same ptr', function() {
        var s = h.allocString('hello world');
        assert(s.isSame(s));
      });

      it('should return true on the same string', function() {
        var s1 = h.allocString('hello world');
        var s2 = h.allocString('hello world');
        assert(s1.isSame(s2));
      });

      it('should return false on different strings', function() {
        var s1 = h.allocString('hello world1');
        var s2 = h.allocString('hello world2');
        assert(!s1.isSame(s2));
      });

      it('should return false on different entities', function() {
        var s1 = h.allocString('hello world1');
        var s2 = h.allocDouble(123.456);
        assert(!s1.isSame(s2));
      });
    });
  });

  describe('Object', function() {
    describe('.set()/.get()', function() {
      it('should store/load single untagged property', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key'), 123);
        assert.equal(o.get(h.allocString('key')), 123);
      });

      it('should store/load single tagged property', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key'), h.allocDouble(123.456));
        assert.equal(o.get(h.allocString('key')).value(), 123.456);
      });

      it('should store/load multiple untagged properties', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key1'), 1);
        o.set(h.allocString('key2'), 2);
        o.set(h.allocString('key3'), 3);
        o.set(h.allocString('key4'), 4);
        assert.equal(o.get(h.allocString('key1')), 1);
        assert.equal(o.get(h.allocString('key2')), 2);
        assert.equal(o.get(h.allocString('key3')), 3);
        assert.equal(o.get(h.allocString('key4')), 4);
      });

      it('should iterate', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key1'), 1);
        o.set(h.allocString('key2'), 2);
        o.set(h.allocString('key3'), 3);
        o.set(h.allocString('key4'), 4);

        var pairs = [];
        o.iterate(function(key, val) {
          pairs.push({ key: key.toString(), value: val });
        });
        pairs.sort(function(a, b) {
          return a.key > b.key ? 1 : a.key < b.key ? -1 : 0;
        });
        assert.deepEqual(pairs, [
          { key: 'key1', value: 1 },
          { key: 'key2', value: 2 },
          { key: 'key3', value: 3 },
          { key: 'key4', value: 4 }
        ]);
      });

      it('should grow', function() {
        var o = h.allocObject(2);
        o.set(h.allocString('key1'), 1);
        o.set(h.allocString('key2'), 2);
        o.set(h.allocString('key3'), 3);
        o.set(h.allocString('key4'), 4);
        assert.equal(o.get(h.allocString('key1')), 1);
        assert.equal(o.get(h.allocString('key2')), 2);
        assert.equal(o.get(h.allocString('key3')), 3);
        assert.equal(o.get(h.allocString('key4')), 4);
      });
    });
  });
});
