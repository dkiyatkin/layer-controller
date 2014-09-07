var EventEmitter2, LayerController, Promise, request, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

_ = require('lodash');

Promise = require('bluebird');

request = require('superagent');

EventEmitter2 = require('eventemitter2').EventEmitter2;

LayerController = (function(_super) {
  __extends(LayerController, _super);

  LayerController.prototype.emitAll = function() {
    var args, event;
    event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    return new Promise((function(_this) {
      return function(resolve, reject) {
        var counter, stop;
        counter = _this.listeners(event).length;
        if (!counter) {
          return resolve(true);
        }
        stop = false;
        args.unshift(event, function(abort) {
          if (stop) {
            return;
          }
          if (abort != null) {
            if (abort instanceof Error) {
              stop = true;
              return reject(abort);
            }
            if (!abort) {
              stop = true;
              return resolve(null);
            }
          }
          if (--counter === 0) {
            return resolve(true);
          }
        });
        return _this.emit.apply(_this, args);
      };
    })(this));
  };

  LayerController.prototype.test = function(testValue) {
    return new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('test', testValue));
        if (testValue === 24) {
          emits.push(_this.emitAll('test.prop', testValue, 42));
        }
        return Promise.all(emits).then(function(emits) {
          var emits2, success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return resolve(null);
            }
          }
          console.log('test action');
          emits2 = [];
          emits.push(_this.emitAll('tested', testValue));
          if (testValue === 24) {
            emits.push(_this.emitAll('tested.prop', testValue, 42));
          }
          return Promise.all(emits2).then(function(emits) {
            var _j, _len1;
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!success) {
                return resolve(null);
              }
            }
            return resolve(_this);
          });
        }).then(null, reject);
      };
    })(this));
  };

  LayerController.prototype.load = function() {};

  LayerController.prototype.parse = function() {};

  LayerController.prototype.reparse = function() {};

  LayerController.prototype.make = function() {};

  LayerController.prototype.insert = function() {};

  LayerController.prototype.show = function() {};

  LayerController.prototype.hide = function() {};

  LayerController.prototype.state = function(state) {};

  LayerController.prototype.reset = function(cacheKey) {};

  function LayerController(parentLayer) {
    LayerController.__super__.constructor.call(this, {
      wildcard: true
    });
    if (parentLayer instanceof LayerController) {
      this.main = parentLayer.main;
    } else {
      this.main = this;
      this.main.cache = {};
    }
    this.config = {};
    this.rel = {};
    this.cache = this.main.cache;
  }

  return LayerController;

})(EventEmitter2);

module.exports = LayerController;
