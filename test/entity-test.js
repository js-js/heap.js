var assert = require('assert');
var heap = require('../');
var jit = require('jit.js');

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
      it('should return undefined on get', function() {
        var o = h.allocObject(32);
        assert(h.isUndef(o.get(h.allocString('key'))));
      });

      it('should store/load single untagged property', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key'), h.smi(123));
        assert.equal(o.get(h.allocString('key')).cast().value(), 123);
      });

      it('should store/load single tagged property', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key'), h.allocDouble(123.456));
        assert.equal(o.get(h.allocString('key')).cast().value(), 123.456);
      });

      it('should store/load multiple untagged properties', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key1'), h.smi(1));
        o.set(h.allocString('key2'), h.smi(2));
        o.set(h.allocString('key3'), h.smi(3));
        o.set(h.allocString('key4'), h.smi(4));
        assert.equal(o.get(h.allocString('key1')).cast().value(), 1);
        assert.equal(o.get(h.allocString('key2')).cast().value(), 2);
        assert.equal(o.get(h.allocString('key3')).cast().value(), 3);
        assert.equal(o.get(h.allocString('key4')).cast().value(), 4);
      });

      it('should iterate', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key1'), h.smi(1));
        o.set(h.allocString('key2'), h.smi(2));
        o.set(h.allocString('key3'), h.smi(3));
        o.set(h.allocString('key4'), h.smi(4));

        var pairs = [];
        o.iterate(function(key, val) {
          pairs.push({ key: key.cast().toString(), value: val.cast().value() });
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

      it('should overwrite value', function() {
        var o = h.allocObject(32);
        o.set(h.allocString('key1'), h.smi(1));
        o.set(h.allocString('key1'), h.smi(2));
        o.set(h.allocString('key1'), h.smi(3));
        o.set(h.allocString('key1'), h.smi(4));

        var pairs = [];
        o.iterate(function(key, val) {
          pairs.push({ key: key.cast().toString(), value: val.cast().value() });
        });
        pairs.sort(function(a, b) {
          return a.key > b.key ? 1 : a.key < b.key ? -1 : 0;
        });
        assert.deepEqual(pairs, [
          { key: 'key1', value: 4 }
        ]);
      });

      it('should grow', function() {
        var o = h.allocObject(2);
        o.set(h.allocString('key1'), h.smi(1));
        o.set(h.allocString('key2'), h.smi(2));
        o.set(h.allocString('key3'), h.smi(3));
        o.set(h.allocString('key4'), h.smi(4));
        assert.equal(o.get(h.allocString('key1')).cast().value(), 1);
        assert.equal(o.get(h.allocString('key2')).cast().value(), 2);
        assert.equal(o.get(h.allocString('key3')).cast().value(), 3);
        assert.equal(o.get(h.allocString('key4')).cast().value(), 4);
      });
    });

    describe('.toJSON()', function() {
      it('should not fail on recursive JSON', function() {
        var o = h.allocObject(2);
        o.set(h.allocString('key1'), o);
        assert.doesNotThrow(function() {
          o.toJSON()
        });
      });
    });
  });

  describe('Code', function() {
    describe('.size()', function() {
      it('should return aligned size of the code', function() {
        var s = h.allocCode(new Buffer(3), []);
        assert.equal(s.size(), heap.ptrSize);
      });
    });

    describe('.offsetCount()', function() {
      it('should return number of offsets', function() {
        var s = h.allocCode(new Buffer(3), [ 0, 8, 16, 24, 32 ]);
        assert.equal(s.offsetCount(), 5);
      });
    });

    describe('.offsets()', function() {
      it('should return offsets', function() {
        var s = h.allocCode(new Buffer(3), [ 0, 8, 16, 24, 32 ]);
        assert.deepEqual(s.offsets(), [
          0, 8, 16, 24, 32
        ]);
      });

      it('should support unaligned offsets', function() {
        var s = h.allocCode(new Buffer(3), [ 0, 1, 2, 3, 4, 5 ]);
        assert.deepEqual(s.offsets(), [
          0, 1, 2, 3, 4, 5
        ]);
      });
    });
  });

  describe('Function', function() {
    describe('.call()', function() {
      it('should invoke assembly code', function() {
        var code = jit.generate(function() {
          this.Proc(function() {
            assert.equal(this.arch, 'x64');
            this.mov('rax', 'rcx');
            this.Return();
          });
        });
        var c = h.allocCode(code.buffer, []);
        code.resolve(c.deref());

        var fn = h.allocFunction(c);
        var r = fn.call(null, [
          h.allocString('hello'),
          h.allocString('ohai')
        ]);
        assert.equal(r.cast().toString(), 'ohai');
      });

      it('should invoke assembly code via wrapper', function() {
        var wrapper = jit.compile(function() {
          this.Proc(function() {
            assert.equal(this.arch, 'x64');

            this.spill([ 'rbx', 'r12', 'r13', 'r14', 'r15' ], function() {
              // Shift args
              this.mov('rax', 'rdi');
              this.mov('rdi', 'rsi');
              this.mov('rsi', 'rdx');
              this.mov('rdx', 'rcx');
              this.mov('rcx', 'r8');

              this.call('rax');
            });
            this.Return();
          });
        })._buffer;
        var h = heap.create({ callWrapper: wrapper });

        var code = jit.generate(function() {
          this.Proc(function() {
            assert.equal(this.arch, 'x64');
            this.mov('rax', 'rcx');
            this.Return();
          });
        });
        var c = h.allocCode(code.buffer, []);
        code.resolve(c.deref());

        var fn = h.allocFunction(c);
        var r = fn.call(h.allocObject(32), [
          h.allocString('hello'),
          h.allocString('ohai')
        ]);
        assert.equal(r.cast().toString(), 'ohai');
      });
    });

    describe('.set()/.get()', function() {
      it('should work like function is an object', function() {
        var fn = h.allocFunction(h.hole);
        fn.set(h.allocString('key'), h.allocString('value'));

        var prop = fn.get(h.allocString('key')).cast();
        assert.equal(prop.toString(), 'value');
      });
    });
  });

  describe('Smi', function() {
    describe('.coerceTo()', function() {
      it('should coerce to boolean', function() {
        var s = h.smi(123);
        assert.equal(s.coerceTo('boolean').value(), true);
        var s = h.smi(0);
        assert.equal(s.coerceTo('boolean').value(), false);
      });
    });
  });
});
