var heap = require('../../heap');
var Base = heap.entities.Base;

var util = require('util');

function Code(heap, ptr) {
  Base.call(this, heap, 'code', ptr);
}
util.inherits(Code, Base);
module.exports = Code;

Code.prototype._rawSize = function _rawSize() {
  return 0;
};
