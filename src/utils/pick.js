const pick = (object, keys) =>
  keys.reduce((result, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key];
    }
    return result;
  }, {});

module.exports = pick;
