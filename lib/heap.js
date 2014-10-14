exports.binding = require('bindings')('heap');
exports.ptrSize = exports.binding.ptrSize;
exports.align = exports.binding.align;

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

exports.BlockSlice = require('./heap/block-slice');
exports.Page = require('./heap/page');
exports.Space = require('./heap/space');
exports.Scope = require('./heap/scope');
exports.VirtualScope = require('./heap/virtual-scope');
exports.MarkCopy = require('./heap/mark-copy');
exports.Visitor = require('./heap/visitor');
exports.Heap = require('./heap/heap');

exports.create = require('./heap/heap').create;
