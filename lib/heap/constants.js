function reverseNum(obj) {
  var res = {};

  Object.keys(obj).forEach(function(key) {
    var val = this[key];
    res[val] = key | 0;
  }, obj);

  return res;
}

exports.type = {
  'double': 1,
  'object': 1,
  'hashmap': 2
};
exports.typeByName = reverseNum(exports.type);
