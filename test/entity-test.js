var assert = require('assert');
var heap = require('../');
var jit = require('jit.js');

describe('Entities', function() {
  var h;
  beforeEach(function() {
    h = heap.create();
  });

  describe('Field', function() {
    it('should export proper shift value', function() {
      var Field = heap.entities.Field;
      assert.equal(5 << Field.shifts.field, Field.fieldSize(5));
    });
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

      it('should cache hash value', function() {
        var s1 = h.allocString('hello world1');
        var s2 = h.allocString('hello world1');
        assert.equal(s1.hash(), s1.hash());
        assert.equal(s1.hash(), s2.hash());
        assert(s1.isSame(s2));
      });
    });
  });

  describe('Object', function() {
    describe('.set()/.get()', function() {
      it('should return undefined on get', function() {
        var o = h.allocObject(32);
        assert(o.get(h.allocString('key')).isUndef());
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
        var o = h.allocObject();
        o.set(h.allocString('key1'), h.smi(1));
        o.set(h.allocString('key2'), h.smi(2));
        o.set(h.allocString('key3'), h.smi(3));
        o.set(h.allocString('key4'), h.smi(4));
        assert.equal(o.get(h.allocString('key1')).cast().value(), 1);
        assert.equal(o.get(h.allocString('key2')).cast().value(), 2);
        assert.equal(o.get(h.allocString('key3')).cast().value(), 3);
        assert.equal(o.get(h.allocString('key4')).cast().value(), 4);
      });

      it('should survive max transitions', function() {
        var o = h.allocObject(32);
        var max = heap.entities.Map.maxTransitions;

        for (var i = 0; i < max - 1; i++)
          o.set(h.smi(i), h.smi(i));

        var old = o.map();
        o.set(h.smi(i++), h.smi(i));
        var next = o.map();
        assert(!next.isSame(old));
        assert(!next.canTransition());

        o.set(h.smi(i++), h.smi(i));
        assert(next.isSame(o.map()));

        assert.equal(o.map().transitionCount(), max);
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
        var o = h.allocObject();

        for (var i = 0; i < 10 * heap.entities.Object.minSize; i++) {
          o.set(h.allocString('key' + i), h.smi(i));
        }

        assert.equal(o.get(h.allocString('key1')).cast().value(), 1);
        assert.equal(o.get(h.allocString('key2')).cast().value(), 2);
        assert.equal(o.get(h.allocString('key3')).cast().value(), 3);
        assert.equal(o.get(h.allocString('key4')).cast().value(), 4);
      });
    });

    describe('transitions', function() {
      it('should transition to the same map', function() {
        var a = h.allocObject();
        var b = h.allocObject();
        var c = h.allocObject();

        a.set(h.allocString('a'), h.undef);
        a.set(h.allocString('b'), h.undef);
        a.set(h.allocString('c'), h.undef);

        b.set(h.allocString('c'), h.undef);
        b.set(h.allocString('a'), h.undef);
        assert(!b.map().isSame(a.map()));
        b.set(h.allocString('b'), h.undef);
        assert(b.map().isSame(a.map()));

        c.set(h.allocString('b'), h.undef);
        c.set(h.allocString('a'), h.undef);
        assert(!c.map().isSame(a.map()));
        assert(!c.map().isSame(b.map()));
        c.set(h.allocString('c'), h.undef);

        assert(c.map().isSame(a.map()));
        assert(c.map().isSame(b.map()));
      });

      it('should always transition global', function() {
        var g = h.allocGlobal();

        var max = heap.entities.Map.maxTransitions;
        for (var i = 0; i < 10 * max; i++) {
          var prev = g.map();
          g.set(h.smi(i), h.smi(i));
          assert(!prev.isSame(g.map()));
        }
      });
    });

    describe('.toJSON()', function() {
      it('should not fail on recursive JSON', function() {
        var o = h.allocObject(2);
        o.set(h.allocString('key1'), o);
        assert.doesNotThrow(function() {
          o.toJSON();
        });
      });
    });
  });

  describe('Array', function() {
    describe('.set()/.get()', function() {
      it('should set dense properties', function() {
        var a = h.allocArray();
        a.set(h.smi(0), h.smi(0));
        a.set(h.smi(1), h.smi(1));

        assert.equal(a.get(h.smi(0)).cast().value(), 0);
        assert.equal(a.get(h.smi(1)).cast().value(), 1);
      });

      it('should grow dense array', function() {
        var a = h.allocArray();
        a.set(h.smi(128), h.smi(128));

        assert.equal(a.get(h.smi(128)).cast().value(), 128);
      });

      it('should transition to non-dense array', function() {
        var a = h.allocArray();
        assert(a.isDense());
        a.set(h.allocString('wtf'), h.smi(128));
        assert(!a.isDense());

        assert.equal(a.get(h.allocString('wtf')).cast().value(), 128);
      });
    });
  });

  describe('Code', function() {
    describe('.size()', function() {
      it('should return non-aligned size of the code', function() {
        var s = h.allocCode(new Buffer(3), []);
        assert.equal(s.size(), 3);
      });
    });

    describe('.alignedSize()', function() {
      it('should return aligned size of the code', function() {
        var s = h.allocCode(new Buffer(3), []);
        assert.equal(s.alignedSize(), heap.ptrSize);
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

    describe('.references()', function() {
      it('should return actual references', function() {
        var code = new Buffer('de7d5b1d00000000', 'hex');
        var s = h.allocCode(code, [ 0 ]);

        var refs = s.references();
        assert.equal(refs.length, 1);
        assert.equal(refs[0].cast().value(), 0xeadbeef);
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
        var wrapperCode = jit.compile(function() {
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

        // NOTE: Old wrapper code
        function wrapper(code, ctx, self, argv) {
          argv.unshift(ctx.deref());
          argv.unshift(self.deref());
          argv.unshift(code);
          return heap.binding.call(wrapperCode, argv);
        }
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
        assert(fn.map().isFunction());

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

  describe('AccessPair', function() {
    describe('.getter()/.setter()', function() {
      it('should return hole as default', function() {
        var p = h.allocAccessPair();
        assert(p.getter().isHole());
        assert(p.setter().isHole());
      });

      it('should return values', function() {
        var p = h.allocAccessPair({
          getter: h.allocFunction(h.hole),
          setter: h.allocFunction(h.hole)
        });
        assert.equal(p.getter().cast().type, 'function');
        assert.equal(p.setter().cast().type, 'function');
      });
    });

    describe('placing in object', function() {
      var acc = new Buffer(heap.ptrSize);
      var getCode = jit.generate(function() {
        this.Proc(function() {
          assert.equal(this.arch, 'x64');
          this.mov('rax', acc.ref());
          this.add([ 'rax' ], 1 << heap.tagShift);
          this.mov('rax', [ 'rax' ]);
          this.Return();
        });
      });
      var setCode = jit.generate(function() {
        this.Proc(function() {
          assert.equal(this.arch, 'x64');
          this.mov('rax', acc.ref());
          this.mov([ 'rax' ], 'rdx');
          this.Return();
        });
      });

      it('should invoke getter', function() {
        acc.fill(0);

        var getter = h.allocFunction(h.allocCode(getCode.buffer));
        var pair = h.allocAccessPair({
          getter: getter
        });

        var o = h.allocObject();
        var key = h.allocString('key');
        o.set(key, pair);

        assert.equal(o.get(key).cast().value(), 1);
        assert.equal(o.get(key).cast().value(), 2);
      });

      it('should invoke setter', function() {
        acc.fill(0);

        var getter = h.allocFunction(h.allocCode(getCode.buffer));
        var setter = h.allocFunction(h.allocCode(setCode.buffer));
        var pair = h.allocAccessPair({
          getter: getter,
          setter: setter
        });

        var o = h.allocObject();
        var key = h.allocString('key');
        o.set(key, pair);

        assert.equal(o.get(key).cast().value(), 1);
        assert.equal(o.get(key).cast().value(), 2);
        o.set(key, h.smi(42));
        assert.equal(o.get(key).cast().value(), 43);
        assert.equal(o.get(key).cast().value(), 44);
      });

      it('should work with no getter/setter', function() {
        var pair = h.allocAccessPair();

        var o = h.allocObject();
        var key = h.allocString('key');
        o.set(key, pair);

        assert(o.get(key).isUndef());
        o.set(key, h.smi(42));
        assert(o.get(key).isUndef());
      });

      it('should be enumerable by default', function() {
        var pair = h.allocAccessPair();

        var o = h.allocObject();
        var key = h.allocString('key');
        o.set(key, pair);

        assert.deepEqual(o.toJSON(), { key: undefined });
      });

      it('should support custom attributes', function() {
        var pair = h.allocAccessPair({
          enumerable: false
        });

        var o = h.allocObject();
        var key = h.allocString('key');
        o.set(key, pair);

        assert.deepEqual(o.toJSON(), {});
      });
    });
  });
});
