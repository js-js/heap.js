exports.binding = require('bindings')('heap');
exports.ptrSize = exports.binding.ptrSize;
exports.align = exports.binding.align;
exports.tagShift = exports.binding.tagShift;
exports.tagMask = exports.binding.tagMask;
exports.tagPointer = exports.binding.tagPointer;
exports.tagSmi = exports.binding.tagSmi;

exports.constants = require('./heap/constants');

exports.utils = require('./heap/utils');

exports.entities = {};
exports.entities.Base = require('./heap/entities/base');
exports.entities.Map = require('./heap/entities/map');
exports.entities.Code = require('./heap/entities/code');
exports.entities.Smi = require('./heap/entities/smi');
exports.entities.Double = require('./heap/entities/double');
exports.entities.String = require('./heap/entities/string');
exports.entities.HashMap = require('./heap/entities/hashmap');
exports.entities.Object = require('./heap/entities/object');
exports.entities.Function = require('./heap/entities/function');
exports.entities.Boolean = require('./heap/entities/boolean');
exports.entities.Global = require('./heap/entities/global');
exports.entities.Context = require('./heap/entities/context');

exports.BlockSlice = require('./heap/block-slice');
exports.Page = require('./heap/page');
exports.Space = require('./heap/space');

exports.scopes = {};
exports.scopes.Base = require('./heap/scopes/base');
exports.scopes.Scope = require('./heap/scopes/scope');
exports.scopes.Virtual = require('./heap/scopes/virtual');

exports.MarkCopy = require('./heap/mark-copy');
exports.Visitor = require('./heap/visitor');
exports.Heap = require('./heap/heap');

exports.create = require('./heap/heap').create;
