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
  this.registerMap('map');
  this.registerMap('oddball');

  this.hole = this.allocOddball('hole');
  this.undef = this.allocOddball('undef');
  this.null_ = this.allocOddball('null');

  this.maps.map._setProto(this.hole);
  this.maps.oddball._setProto(this.hole);
  this.maps.map._setEdges(this.hole);
  this.maps.oddball._setEdges(this.hole);

  var Map = heap.entities.Map;

  this.registerMap('field');
  this.registerMap('object', null, Map.flags.object | Map.flags.transition);

  this.maps.object._setProto(this.allocObject());
  this.maps.object._setEdges(this.allocObject());

  this.registerMap('code');
  this.registerMap('state');
  this.registerMap('smi', 'object');
  this.registerMap('double', 'object');
  this.registerMap('string', 'object');
  this.registerMap('boolean', 'object');
  this.registerMap('function',
                   'object',
                   Map.flags.object | Map.flags.fn | Map.flags.transition);
  this.registerMap('array', 'object', Map.flags.object);
  this.registerMap('dense-array', 'object', Map.flags.object);
  this.maps['dense-array']._setProto(this.maps.array.proto());
  this.registerMap('access-object', 'object', Map.flags.object);
  this.maps['access-object']._setProto(this.maps['access-object'].proto());
  this.registerMap('access-pair');

  this.registerMap('global',
                   'object',
                   Map.flags.object |
                       Map.flags.transition |
                       Map.flags.megamorphic);

  this.true_ = this.allocBoolean(true);
  this.false_ = this.allocBoolean(false);

  this.state = this.allocState();

  // Global map transitions
  this.transitions = this.allocObject();
  this.transitions._updateMap(this.allocMap('object', Map.flags.object));
}
module.exports = Heap;

Heap.create = function create(options) {
  return new Heap(options);
};

Heap.prototype.createScope = function createScope() {
  return new heap.scopes.Scope(this);
};

Heap.prototype.scope = function scope(cb, ctx) {
  var s = this.createScope();
  var res = s.wrap(function scopeWrap() {
    return cb.call(ctx, s);
  });

  // Re-wrap handles returned from scope
  if ((res instanceof heap.entities.Base) && res.scope === s)
    res.move(this.currentScope());
  return res;
};

Heap.prototype.virtualScope = function virtualScope(cb, ctx) {
  var scope = new heap.scopes.Virtual(this);

  return scope.wrap(function scopeWrap() {
    return cb.call(ctx, scope);
  });
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

Heap.prototype.allocMap = function allocMap(flags) {
  var Map = heap.entities.Map;
  var res = this.allocTagged('data', 'map', Map.size());

  // Type
  binding.writeTagged(res, this.maps.map ? this.maps.map.deref() : res, 0);

  // Flags
  binding.writeTagged(res, flags | 0, Map.offsets.flags);

  // Transition count
  binding.writeTagged(res, 0, Map.offsets.transitionCount);

  if (this.maps.object) {
    this.virtualScope(function() {
      var obj = this.allocObject();
      binding.writeTagged(res, obj.deref(), Map.offsets.proto);

      // Hidden-class edges
      var edges = (flags & Map.flags.object) ? this.allocObject() : this.hole;
      binding.writeTagged(res, edges.deref(), Map.offsets.edges);
    }, this);
    res = new Map(this, res);
    this.runPendingGC();
    return res;
  } else if (this.hole) {
    binding.writeTagged(res, this.hole.deref(), Map.offsets.proto);
    binding.writeTagged(res, this.hole.deref(), Map.offsets.edges);
  }

  return new Map(this, res);
};

Heap.prototype.allocOddball = function allocOddball(kind) {
  return heap.entities.Oddball.alloc(this, kind);
};

Heap.prototype.allocDouble = function allocDouble(val) {
  return heap.entities.Double.alloc(this, val);
};

Heap.prototype.allocNumber = function allocNumber(val) {
  if ((val & heap.smiMask) === val)
    return this.smi(val);
  else
    return this.allocDouble(val);
};

Heap.prototype.allocString = function allocString(val) {
  return heap.entities.String.alloc(this, val);
};

Heap.prototype.allocField = function allocField(size) {
  return heap.entities.Field.alloc(this, size);
};

Heap.prototype._allocObject = function _allocObject(map, size) {
  var Object = heap.entities.Object;
  var KeyDict = heap.entities.dict.Key;
  var fieldSize = heap.entities.Object.minSize;

  assert.equal((fieldSize & ~(fieldSize - 1)), fieldSize,
               'fieldSize of object should be power of 2');

  var res = this.allocTagged('data', map, size);

  // Calculate real field size
  fieldSize = KeyDict.offsets.itemSize * fieldSize;

  this.virtualScope(function() {
    binding.writeTagged(res,
                        this.allocField(fieldSize).deref(),
                        Object.offsets.field);
  }, this);

  return res;
};

Heap.prototype.allocObject = function allocObject() {
  var Object = heap.entities.Object;
  var res = this._allocObject('object', Object.size());
  res = new Object(this, res);
  this.runPendingGC();
  return res;
};

Heap.prototype.allocGlobal = function allocGlobal() {
  var Global = heap.entities.Global;
  var res = this._allocObject('global', Global.size());
  res = new Global(this, res);
  this.runPendingGC();
  return res;
};

Heap.prototype.allocFunction = function allocFunction(code, outer, slots) {
  return heap.entities.Function.alloc(this, code, outer, slots);
};

Heap.prototype.allocArray = function allocArray() {
  var Object = heap.entities.Object;
  var Array = heap.entities.Array;
  var res = this._allocObject('dense-array', Array.size());

  binding.writeTagged(res, 0, Array.offsets.length);

  res = new Array(this, res);
  this.runPendingGC();
  res._updateFlags(Object.flags.dense);
  return res;
};

Heap.prototype.allocState = function allocState() {
  return heap.entities.State.alloc(this);
};

Heap.prototype.allocCode = function allocCode(buf, offsets, weak) {
  return heap.entities.Code.alloc(this, buf, offsets, weak);
};

Heap.prototype.allocBoolean = function allocBoolean(value) {
  return heap.entities.Boolean.alloc(this, value);
};

Heap.prototype.allocAccessPair = function allocAccessPair(pair) {
  return heap.entities.AccessPair.alloc(this, pair);
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
  else if (this.checkMap('field', map))
    return new heap.entities.Field(this, handle);
  else if (this.checkMap('code', map))
    return new heap.entities.Code(this, handle);
  else if (this.checkMap('smi', map))
    return new heap.entities.Smi(this, handle);
  else if (this.checkMap('double', map))
    return new heap.entities.Double(this, handle);
  else if (this.checkMap('string', map))
    return new heap.entities.String(this, handle);
  else if (this.checkMap('boolean', map))
    return new heap.entities.Boolean(this, handle);
  else if (this.checkMap('global', map))
    return new heap.entities.Global(this, handle);
  else if (this.checkMap('state', map))
    return new heap.entities.State(this, handle);
  else if (this.checkMap('oddball', map))
    return new heap.entities.Oddball(this, handle);
  else if (this.checkMap('access-pair', map))
    return new heap.entities.AccessPair(this, handle);
  else if (map.isFunction())
    return new heap.entities.Function(this, handle);
  else
    return new heap.entities.Object(this, handle);
};

Heap.prototype.registerMap = function registerMap(name, parent, flags) {
  var map = this.allocMap(flags | 0);
  this.maps[name] = map;
  if (parent)
    map.proto()._updateMap(this.maps[parent]);
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

Heap.prototype.fromJSON = function fromJSON(value) {
  if (value === null)
    return this.null_;

  if (typeof value === 'number')
    return this.allocNumber(value);
  else if (typeof value === 'string')
    return this.allocString(value);
  else if (typeof value === 'undefined')
    return this.undef;

  assert.equal(typeof value, 'object');
  assert(!Array.isArray(value));

  var res = this.allocObject();

  Object.keys(value).forEach(function(key) {
    res.set(this.allocString(key), this.fromJSON(value[key]));
  }, this);

  return res;
};
