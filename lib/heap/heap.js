var heap = require('../heap');
var BlockSlice = heap.BlockSlice;
var Space = heap.Space;
var binding = heap.binding;

var assert = require('assert');
var Buffer = require('buffer').Buffer;

function Heap(options) {
  this.options = options || {};
  this.blockSlice = new BlockSlice();

  this.spaces = {
    data: new Space(this, 'data', heap.constants.page.size),
    code: new Space(this, 'code', heap.constants.page.size)
  };

  this.collector = new heap.MarkCopy(this);
  this.visitor = new heap.Visitor(this);
  this.pendingGC = null;

  this.scopes = [];

  // References from Code space to Data space
  this.codeRefs = new heap.scopes.Scope(this);
  this.codeRefs.type = 'code-refs';
  this.codeRefs.enter();

  // Global maps and handles
  this.globals = new heap.scopes.Scope(this);
  this.globals.type = 'global';
  this.globals.enter();

  this.maps = {};
  this.registerMap('map', null);
  this.registerMap('hashmap', 'map');
  this.registerMap('object', 'map');
  this.registerMap('code', 'map');
  this.registerMap('context', 'map');
  this.registerMap('smi', 'object');
  this.registerMap('double', 'object');
  this.registerMap('string', 'object');
  this.registerMap('function', 'object');
  this.registerMap('boolean', 'object');
  this.registerMap('global', 'object');
  this.registerMap('oddball', 'map');

  this.hole = this.allocOddball('hole');
  this.undef = this.allocOddball('undef');
  this.true_ = this.allocBoolean(true);
  this.false_ = this.allocBoolean(false);

  this.context = this.allocContext();
}
module.exports = Heap;

Heap.create = function create(options) {
  return new Heap(options);
};

Heap.prototype.scope = function scope(cb, ctx) {
  var scope = new heap.scopes.Scope(this);
  scope.enter();

  var res = cb.call(ctx, scope);
  scope.leave();

  // Re-wrap handles returned from scope
  if ((res instanceof heap.entities.Base) && res.scope === scope)
    res.move(this.currentScope());
  return res;
};

Heap.prototype.virtualScope = function virtualScope(cb, ctx) {
  var scope = new heap.scopes.Virtual(this);
  scope.enter();

  var res = cb.call(ctx, scope);
  scope.leave();

  return res;
};

Heap.prototype.enterScope = function enterScope(scope) {
  this.scopes.push(scope);
};

Heap.prototype.leaveScope = function leaveScope(scope) {
  for (var i = this.scopes.length - 1; i >= 0; i--)
    if (this.scopes[i] === scope)
      return this.scopes.splice(i, 1);
};

Heap.prototype.currentScope = function currentScope() {
  return this.scopes[this.scopes.length - 1];
};

Heap.prototype.smi = function smi(value) {
  return new heap.entities.Smi(this, value);
};

Heap.prototype.allocTagged = function allogTagged(space, type, size) {
  var res = this.spaces[space].allocRaw(size);
  var map = this.maps[type];

  if (map)
    map = map.deref();
  else
    map = res;
  binding.writeTagged(res, map, heap.entities.Base.offsets.map);
  return res;
};

Heap.prototype.allocMap = function allocMap(parent) {
  var Map = heap.entities.Map;
  var res = this.allocTagged('data', 'map', Map.size());

  // Type
  binding.writeTagged(res, this.maps.map ? this.maps.map.deref() : res, 0);

  // Parent map
  binding.writeTagged(res,
                      parent ? this.maps[parent].deref() : res,
                      Map.offsets.parent);
  return new Map(this, res);
};

Heap.prototype.allocOddball = function allocOddball(kind) {
  var Oddball = heap.entities.Oddball;
  var res = this.allocTagged('data', 'oddball', Oddball.size());
  res[Oddball.offsets.kind] = Oddball.kind[kind];
  return new Oddball(this, res);
};

Heap.prototype.allocDouble = function allocDouble(val) {
  var Double = heap.entities.Double;
  var res = this.allocTagged('data', 'double', Double.size());
  res.writeDoubleLE(val, Double.offsets.value, true);
  return new Double(this, res);
};

Heap.prototype.allocString = function allocString(val) {
  var String = heap.entities.String;
  var len = Buffer.byteLength(val);
  var res = this.allocTagged('data', 'string', String.size(len));

  binding.writeTagged(res, len, String.offsets.length);
  res.write(val, String.offsets.data);

  return new String(this, res);
};

Heap.prototype.allocHashMap = function allocHashMap(size) {
  var HashMap = heap.entities.HashMap;
  // NOTE: We allocate twice the `size` to store keys
  var res = this.allocTagged('data', 'hashmap', HashMap.size(size));

  // Hashmap size
  binding.writeTagged(res, size, HashMap.offsets.size);

  // Hashmap contents (holes)
  var hole = this.hole.deref();
  for (var i = 0; i < size; i++) {
    binding.writeTagged(res,
                        hole,
                        HashMap.offsets.field + 2 * i *  heap.ptrSize);
  }

  return new HashMap(this, res);
};

Heap.prototype._allocObject = function _allocObject(map, size) {
  var Object = heap.entities.Object;
  if (!size)
    size = 0;
  size = Math.max(heap.entities.HashMap.minSize, size);

  assert.equal((size & ~(size - 1)), size,
               'size of object should be power of 2');

  var res = this.allocTagged('data', map, Object.size());

  this.virtualScope(function() {
    binding.writeTagged(res,
                        this.allocHashMap(size).deref(),
                        Object.offsets.hashmap);
  }, this);

  return res;
};

Heap.prototype.allocObject = function allocObject(size) {
  var res = this._allocObject('object', size);
  res = new heap.entities.Object(this, res);
  this.runPendingGC();
  return res;
};

Heap.prototype.allocGlobal = function allocGlobal(size) {
  var res = this._allocObject('global', size);
  res = new heap.entities.Global(this, res);
  this.runPendingGC();
  return res;
};

Heap.prototype.allocContext = function allocContext() {
  var Context = heap.entities.Context;
  var res = this.allocTagged('data', 'context', Context.size());

  this.virtualScope(function() {
    var global = this.allocGlobal(32).deref();
    binding.writeTagged(res, global, Context.offsets.global);
    binding.writeTagged(res, global, Context.offsets.self);
  }, this);
  binding.writeTagged(res, this.hole.deref(), Context.offsets.fn);

  binding.writeTagged(res,
                      this.spaces.data.startRef,
                      Context.offsets.heap);
  binding.writeTagged(res,
                      this.spaces.data.limitRef,
                      Context.offsets.heapLimit);

  res = new Context(this, res);
  this.runPendingGC();
  return res;
};

Heap.prototype.allocCode = function allocCode(buf, offsets) {
  var Code = heap.entities.Code;

  // Align
  var codeSize = buf.length;
  if ((codeSize % heap.ptrSize) != 0)
    codeSize += heap.ptrSize - (codeSize % heap.ptrSize);

  // length of code, code, length of offsets, offsets
  var size = Code.size(codeSize, offsets.length);
  var res = this.allocTagged('code', 'code', size);

  // Code length + code
  binding.writeTagged(res, codeSize, Code.offsets.size);
  buf.copy(res, Code.offsets.code);

  // Offsets length + offsets
  var off = Code.offsets.code + codeSize;
  binding.writeTagged(res, offsets.length, off);
  off += heap.ptrSize;

  for (var i = 0; i < offsets.length; i++, off += heap.ptrSize)
    binding.writeTagged(res, offsets[i], off);

  // Keep cross-references for GC
  this.codeRefs.add(res);
  return new Code(this, res);
};

Heap.prototype.allocFunction = function allocFunction(code) {
  var Function = heap.entities.Function;
  var res = this.allocTagged('data', 'function', Function.size());

  binding.writeTagged(res, code.deref(), Function.offsets.code);

  return new Function(this, res);
};

Heap.prototype.allocBoolean = function allocBoolean(value) {
  var Boolean = heap.entities.Boolean;
  var res = this.allocTagged('data', 'boolean', Boolean.size());

  binding.writeTagged(res, value ? 1 : 0, Boolean.offsets.value);

  return new Boolean(this, res);
};

Heap.prototype.wrapPtr = function wrapPtr(ptr) {
  var deref = binding.readTagged(ptr, 0);
  return this.wrap(deref);
};

Heap.prototype.wrap = function wrap(ptr) {
  return new heap.entities.Base(this, 'unknown', ptr);
};

Heap.prototype.cast = function cast(handle, mapHandle) {
  var map = mapHandle || handle.map();

  if (this.checkMap('map', map))
    return new heap.entities.Map(this, handle);
  else if (this.checkMap('hashmap', map))
    return new heap.entities.HashMap(this, handle);
  else if (this.checkMap('code', map))
    return new heap.entities.Code(this, handle);
  else if (this.checkMap('smi', map))
    return new heap.entities.Smi(this, handle);
  else if (this.checkMap('double', map))
    return new heap.entities.Double(this, handle);
  else if (this.checkMap('string', map))
    return new heap.entities.String(this, handle);
  else if (this.checkMap('function', map))
    return new heap.entities.Function(this, handle);
  else if (this.checkMap('boolean', map))
    return new heap.entities.Boolean(this, handle);
  else if (this.checkMap('global', map))
    return new heap.entities.Global(this, handle);
  else if (this.checkMap('context', map))
    return new heap.entities.Context(this, handle);
  else if (this.checkMap('oddball', map))
    return new heap.entities.Oddball(this, handle);
  else
    return new heap.entities.Object(this, handle);
};

Heap.prototype.registerMap = function registerMap(name, parent) {
  var map = this.allocMap(parent);
  this.maps[name] = map;
  return map;
};

Heap.prototype.checkMap = function checkMap(name, handle) {
  var map = this.maps[name];
  return map.isSame(handle);
};

Heap.prototype.isHole = function isHole(handle) {
  var h = handle.deref();
  if (typeof h === 'number')
    return false;
  return binding.isSame(h, this.hole.deref());
};

Heap.prototype.isUndef = function isUndef(handle) {
  var h = handle.deref();
  if (typeof h === 'number')
    return false;
  return binding.isSame(h, this.undef.deref());
};

Heap.prototype.getSpace = function getSpace(ptr, map) {
  // Smi
  if (typeof ptr === 'number')
    return this.spaces.data;

  if (!map)
    map = binding.readTagged(ptr, heap.entities.Base.offsets.map);
  if (binding.isSame(this.maps.code.deref(), map))
    return this.spaces.code;
  else
    return this.spaces.data;
};

Heap.prototype.runPendingGC = function runPendingGC(space) {
  if (this.pendingGC === null)
    return false;

  return this.gc(this.pendingGC);
};

Heap.prototype.gc = function gc(space) {
  // Don't allow GC in virtual scope
  if (this.currentScope().type === 'virtual') {
    this.pendingGC = space;
    return false;
  }

  this.pendingGC = null;

  // No collection will happen there, but we still want to be able to create
  // handles
  this.virtualScope(function() {
    this.collector.run(space ? this.spaces[space] : this.spaces.data);
  }, this);

  return true;
};

Heap.prototype.visit = function visit(ptr, cb) {
  this.visitor.visit(ptr, cb);
};
