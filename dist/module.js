var EventEmitter2, Module, moduleKeywords,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  __slice = [].slice;

EventEmitter2 = require('eventemitter2').EventEmitter2;

moduleKeywords = ['extended', 'included'];

Module = (function(_super) {
  __extends(Module, _super);

  function Module() {
    return Module.__super__.constructor.apply(this, arguments);
  }

  Module.extend = function(obj) {
    var key, value, _ref;
    for (key in obj) {
      value = obj[key];
      if (__indexOf.call(moduleKeywords, key) < 0) {
        this[key] = value;
      }
    }
    if ((_ref = obj.extended) != null) {
      _ref.apply(this);
    }
    return this;
  };

  Module.include = function(obj) {
    var key, value, _ref;
    for (key in obj) {
      value = obj[key];
      if (__indexOf.call(moduleKeywords, key) < 0) {
        this.prototype[key] = value;
      }
    }
    if ((_ref = obj.included) != null) {
      _ref.apply(this);
    }
    return this;
  };

  Module.mixOf = function() {
    var Mixed, base, method, mixin, mixins, name, _i, _ref;
    base = arguments[0], mixins = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    Mixed = (function(_super1) {
      __extends(Mixed, _super1);

      function Mixed() {
        return Mixed.__super__.constructor.apply(this, arguments);
      }

      return Mixed;

    })(base);
    for (_i = mixins.length - 1; _i >= 0; _i += -1) {
      mixin = mixins[_i];
      _ref = mixin.prototype;
      for (name in _ref) {
        method = _ref[name];
        Mixed.prototype[name] = method;
      }
    }
    return Mixed;
  };

  return Module;

})(EventEmitter2);

Module.EventEmitter2 = EventEmitter2;

module.exports = Module;
