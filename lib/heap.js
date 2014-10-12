exports.binding = require('bindings')('heap');
exports.ptrSize = exports.binding.ptrSize;

exports.constants = require('./heap/constants');

exports.utils = require('./heap/utils');

exports.entities = {};
exports.entities.Base = require('./heap/entities/base');
exports.entities.Double = require('./heap/entities/double');
exports.entities.String = require('./heap/entities/string');
exports.entities.HashMap = require('./heap/entities/hashmap');
exports.entities.Object = require('./heap/entities/object');

exports.Page = require('./heap/page');
exports.Space = require('./heap/space');
exports.Scope = require('./heap/scope');
exports.Heap = require('./heap/heap');

exports.create = require('./heap/heap').create;
