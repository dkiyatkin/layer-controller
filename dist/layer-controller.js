var EventEmitter2, LayerController, Log, Promise, pasteHTML, superagent, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

_ = require('lodash');

Promise = require('bluebird');

superagent = require('superagent');

EventEmitter2 = require('eventemitter2').EventEmitter2;

pasteHTML = require('./pasteHTML');

Log = require('./log');

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
    if (!this.busy.test) {
      this.busy.test = {};
    }
    if (this.busy.test[testValue]) {
      return this.busy.test[testValue];
    }
    return this.busy.test[testValue] = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('test', testValue));
        if (testValue === 24) {
          emits.push(_this.emitAll('test.prop', testValue, 42));
        }
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.test[testValue];
            return resolve(null);
          }
          if (_this.testCount == null) {
            _this.testCount = 0;
          }
          _this.testCount++;
          _this.log.debug('test action');
          emits = [];
          emits.push(_this.emitAll('tested', testValue));
          if (testValue === 24) {
            emits.push(_this.emitAll('tested.prop', testValue, 42));
          }
          return Promise.all(emits).then(function(emits) {
            var _j, _len1;
            delete _this.busy.test[testValue];
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!success) {
                return resolve(null);
              }
            }
            return resolve(_this);
          });
        }).then(null, function(err) {
          delete _this.busy.test[testValue];
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype.render = function(tpl) {
    return _.template(tpl, this);
  };

  LayerController.prototype._load = function(path, key, data) {
    var paths, _key, _path;
    this.log.debug('_load', path, key, data);
    if (!this.data) {
      this.data = {};
    }
    if (!this._data) {
      this._data = {};
    }
    if (!path) {
      path = this.download;
      data = this.data;
      key = 'tpl';
    }
    if ((key != null) && !data) {
      data = this.data;
    }
    if (_.isString(path)) {
      path = this.render(path);
      if (this.request.origin && path.search('//') !== 0 && path.search('/') === 0) {
        path = this.request.origin + path;
      }
      if (this.request.cache[path]) {
        if (!((key != null) && data)) {
          return Promise.resolve(this.request.cache[path]);
        }
        data[key] = this.request.cache[path];
        return Promise.resolve(data);
      }
      if (!this.request.loading[path]) {
        this.request.loading[path] = this.request.agent.get(path);
        if (this.request.headers) {
          this.request.loading[path].set(this.request.headers);
        }
        this.request.loading[path].set('x-layer-controller-proxy', 'true');
        this.request.loading[path] = Promise.promisify(this.request.loading[path].end, this.request.loading[path])();
      }
      return this.request.loading[path].then((function(_this) {
        return function(res) {
          var _ref;
          delete _this.request.loading[path];
          if (res.error) {
            _this.log.error("load " + path + ":", ((_ref = res.error) != null ? _ref.message : void 0) || res.error);
            return;
          }
          if (res.body && Object.keys(res.body).length) {
            _this.request.cache[path] = res.body;
          } else {
            _this.request.cache[path] = res.text;
          }
          _this._data[path] = _this.request.cache[path];
          if (!((key != null) && data)) {
            return _this.request.cache[path];
          }
          data[key] = _this.request.cache[path];
          return data;
        };
      })(this));
    } else if (_.isArray(path)) {
      return Promise.each(path, (function(_this) {
        return function(item, i, value) {
          return _this._load(item, i, data);
        };
      })(this)).then(function(results) {
        return data;
      });
    } else if (_.isObject(path)) {
      paths = [];
      for (_key in path) {
        if (!__hasProp.call(path, _key)) continue;
        _path = path[_key];
        if (_.isObject(_path)) {
          data[_key] = {};
          paths.push(this._load(_path, _key, data[_key]));
        } else {
          paths.push(this._load(_path, _key, data));
        }
      }
      return Promise.all(paths).then(function() {
        return data;
      });
    }
  };

  LayerController.prototype.load = function() {
    if (this.busy.load) {
      return this.busy.load;
    }
    if (this.data != null) {
      return Promise.resolve(this);
    }
    if (!this.download) {
      return Promise.reject(new Error("layer.download does not exist: " + this.name));
    }
    return this.busy.load = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('load'));
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.load;
            return resolve(null);
          }
          return _this._load().then(function() {
            emits = [];
            emits.push(_this.emitAll('loaded'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              delete _this.busy.load;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return resolve(null);
                }
              }
              return resolve(_this);
            });
          });
        }).then(null, function(err) {
          delete _this.busy.load;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype.reparse = function(childLayers) {
    var _all, _i, _layer, _len, _ref;
    if (childLayers == null) {
      childLayers = true;
    }
    _all = [];
    if (childLayers) {
      _ref = this.childLayers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        _layer = _ref[_i];
        _all.push(_layer.reparse(childLayers));
      }
    }
    return Promise.all(_all).then((function(_this) {
      return function(layers) {
        return _this.make().then(function(layer) {
          if (!layer) {
            return null;
          }
          return _this.insert();
        });
      };
    })(this));
  };

  LayerController.prototype.parse = function() {
    var _ref;
    if (this.busy.parse) {
      return this.busy.parse;
    }
    if (this.html != null) {
      return Promise.resolve(this);
    }
    if (((_ref = this.data) != null ? _ref.tpl : void 0) == null) {
      return Promise.reject(new Error("layer.data.tpl does not exist: " + this.name));
    }
    return this.busy.parse = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('parse'));
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.parse;
            return resolve(null);
          }
          _this.html = _this.render(_this.data.tpl);
          emits = [];
          emits.push(_this.emitAll('parsed'));
          return Promise.all(emits).then(function(emits) {
            var _j, _len1;
            delete _this.busy.parse;
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!(!success)) {
                continue;
              }
              _this.html = null;
              return resolve(null);
            }
            return resolve(_this);
          });
        }).then(null, function(err) {
          delete _this.busy.parse;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype._make = function() {
    var _ref;
    if (this.download) {
      return this.load().then((function(_this) {
        return function(layer) {
          if (!layer) {
            return null;
          }
          return _this.parse();
        };
      })(this));
    } else {
      if (((_ref = this.data) != null ? _ref.tpl : void 0) == null) {
        return Promise.resolve(this);
      }
      return this.parse();
    }
  };

  LayerController.prototype.make = function() {
    if (this.busy.make) {
      return this.busy.make;
    }
    return this.busy.make = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('make'));
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.make;
            return resolve(null);
          }
          return _this._make().then(function(layer) {
            if (!layer) {
              delete _this.busy.make;
              return resolve(null);
            }
            emits = [];
            emits.push(_this.emitAll('made'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              delete _this.busy.make;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return resolve(null);
                }
              }
              return resolve(_this);
            });
          });
        }).then(null, function(err) {
          delete _this.busy.make;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype.findElements = function(node, selectors) {
    var element, elementList, _i, _len, _ref, _ref1;
    if (node == null) {
      node = this.parentNode || ((_ref = this.parentLayer) != null ? _ref.elementList : void 0);
    }
    if (selectors == null) {
      selectors = this.selectors;
    }
    this.log.debug('findElements');
    if (!node || !selectors) {
      return null;
    }
    if (node.find && node.html) {
      return node.find(selectors);
    }
    if (node.querySelectorAll) {
      return node.querySelectorAll(selectors);
    }
    if (!((_ref1 = node[0]) != null ? _ref1.querySelectorAll : void 0)) {
      return null;
    }
    elementList = [];
    for (_i = 0, _len = node.length; _i < _len; _i++) {
      element = node[_i];
      elementList = elementList.concat(_.toArray(element.querySelectorAll(selectors)));
    }
    return elementList;
  };

  LayerController.prototype.htmlElements = function(elementList, html) {
    if (html == null) {
      html = '';
    }
    if (elementList.html) {
      return elementList.html(html);
    }
    return Array.prototype.forEach.call(elementList, function(element) {
      return pasteHTML(element, html);
    });
  };

  LayerController.prototype.insert = function(force) {
    if (force == null) {
      force = true;
    }
    if (this.busy.insert) {
      return this.busy.insert;
    }
    if (!this.selectors) {
      return Promise.reject(new Error(this.log.error('layer.selectors does not exist')));
    }
    return this.busy.insert = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('insert'));
        return Promise.all(emits).then(function(emits) {
          var elementList, success, _i, _len, _ref;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.insert;
            return resolve(null);
          }
          if (!(!force && ((_ref = _this.elementList) != null ? _ref.length : void 0))) {
            _this.elementList = null;
            elementList = _this.findElements();
            if (!(elementList != null ? elementList.length : void 0)) {
              delete _this.busy.insert;
              return resolve(null);
            }
            _this.htmlElements(elementList, _this.html);
            _this.elementList = elementList;
          }
          emits = [];
          emits.push(_this.emitAll('inserted'));
          emits.push(_this.emitAll('domready'));
          return Promise.all(emits).then(function(emits) {
            var _j, _len1;
            delete _this.busy.insert;
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!success) {
                return resolve(null);
              }
            }
            return resolve(_this);
          });
        }).then(null, function(err) {
          delete _this.busy.insert;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype._show = function(childLayers) {
    return this.make().then((function(_this) {
      return function(layer) {
        var _ref, _ref1;
        if (!layer) {
          return null;
        }
        if (!childLayers) {
          return _this.insert(!((_ref = _this.elementList) != null ? _ref.length : void 0));
        }
        return _this.insert(!((_ref1 = _this.elementList) != null ? _ref1.length : void 0)).then(function(layer) {
          var _all, _i, _layer, _len, _ref1;
          if (!layer) {
            return null;
          }
          _all = [];
          _ref1 = _this.childLayers;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            _layer = _ref1[_i];
            _all.push(_layer.show(childLayers));
          }
          return Promise.all(_all).then(function(layers) {
            return _this;
          });
        });
      };
    })(this));
  };

  LayerController.prototype.show = function(childLayers) {
    if (this.busy.show) {
      return this.busy.show;
    }
    if (this.isShown) {
      return Promise.resolve(this);
    }
    return this.busy.show = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('show'));
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.show;
            return resolve(null);
          }
          return _this._show(childLayers).then(function(layer) {
            if (!layer) {
              delete _this.busy.show;
              return resolve(null);
            }
            emits = [];
            emits.push(_this.emitAll('showed'));
            emits.push(_this.emitAll('shown'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              delete _this.busy.show;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return resolve(null);
                }
              }
              _this.isShown = true;
              return resolve(_this);
            });
          });
        }).then(null, function(err) {
          delete _this.busy.show;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype._hide = function(childLayers) {
    var _all, _i, _layer, _len, _ref;
    if (childLayers == null) {
      childLayers = true;
    }
    if (!childLayers) {
      this.htmlElements(this.elementList, '');
      return Promise.resolve(this);
    }
    _all = [];
    _ref = this.childLayers;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _layer = _ref[_i];
      _all.push(_layer.hide(childLayers));
    }
    return Promise.all(_all).then((function(_this) {
      return function(layers) {
        _this.htmlElements(_this.elementList, '');
        return _this;
      };
    })(this));
  };

  LayerController.prototype.hide = function(childLayers) {
    if (childLayers == null) {
      childLayers = true;
    }
    if (this.busy.hide) {
      return this.busy.hide;
    }
    if (!this.isShown && !this.elementList) {
      Promise.resolve(this);
    }
    return this.busy.hide = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('hide'));
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.hide;
            return resolve(null);
          }
          return _this._hide(childLayers).then(function(layer) {
            if (!layer) {
              delete _this.busy.hide;
              return resolve(null);
            }
            _this.isShown = false;
            _this.elementList = null;
            emits = [];
            emits.push(_this.emitAll('hidden'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              delete _this.busy.hide;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return resolve(null);
                }
              }
              return resolve(_this);
            });
          });
        }).then(null, function(err) {
          delete _this.busy.hide;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype._state = function(state, childLayers) {
    if (!this.selectors) {
      return Promise.resolve(this);
    }
    if (!this.regState || (state.search(this.regState) !== -1)) {
      if (!childLayers) {
        return this.show();
      }
      return this.show().then((function(_this) {
        return function(layer) {
          var _all, _i, _layer, _len, _ref;
          if (!layer) {
            return null;
          }
          _all = [];
          _ref = _this.childLayers;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            _layer = _ref[_i];
            _all.push(_layer.state(state, childLayers));
          }
          return Promise.all(_all).then(function(layers) {
            return _this;
          });
        };
      })(this));
    } else {
      return this.hide(childLayers);
    }
  };

  LayerController.prototype.state = function(state, childLayers) {
    var pushed;
    if (state == null) {
      state = '';
    }
    if (!this.busy.state) {
      this.busy.state = {
        queue: []
      };
    }
    if (this.busy.state.run) {
      pushed = this.busy.state.queue.push(state);
      return this.busy.state.run.then((function(_this) {
        return function() {
          if (_this.busy.state.queue.length !== pushed) {
            return null;
          }
          _this.busy.queue = [];
          return _this.busy.state.run = _this.state(state);
        };
      })(this));
    }
    return this.busy.state.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        _this.state.next = state;
        _this.state.equal = (_this.state.current === _this.state.next ? true : false);
        _this.state.progress = ((_this.state.current != null) && !_this.state.equal ? true : false);
        emits = [];
        emits.push(_this.emitAll('state'));
        if (_this.state.current != null) {
          emits.push(_this.emitAll('state.next'));
        }
        return Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!(!success)) {
              continue;
            }
            delete _this.busy.state.run;
            return resolve(null);
          }
          return _this._state(state, childLayers).then(function(layer) {
            if (!layer) {
              delete _this.busy.state.run;
              return resolve(null);
            }
            _this.state.last = _this.state.current;
            _this.state.current = state;
            delete _this.state.next;
            emits = [];
            emits.push(_this.emitAll('stated'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              delete _this.busy.state.run;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return resolve(null);
                }
              }
              return resolve(_this);
            });
          });
        }).then(null, function(err) {
          delete _this.busy.state.run;
          return reject(err);
        });
      };
    })(this));
  };

  LayerController.prototype.reset = function(cacheKey) {
    var data, path, _ref;
    delete this.html;
    delete this.data;
    if (!cacheKey) {
      return true;
    }
    if (!this._data || !this.download) {
      return false;
    }
    if (_.isString(cacheKey)) {
      path = this.render(this.download[cacheKey]);
      if (!path) {
        return false;
      }
      delete this._data[path];
      delete this.request.cache[path];
      return true;
    }
    if (_.isBoolean(cacheKey)) {
      _ref = this._data;
      for (path in _ref) {
        if (!__hasProp.call(_ref, path)) continue;
        data = _ref[path];
        delete this._data[path];
        delete this.request.cache[path];
      }
      return true;
    }
    return false;
  };

  function LayerController(parentLayer) {
    LayerController.__super__.constructor.call(this, {
      wildcard: true
    });
    this.childLayers = [];
    if (parentLayer instanceof LayerController) {
      this.parentLayer = parentLayer;
      this.parentLayer.childLayers.push(this);
      this.main = parentLayer.main;
      this.request = this.main.request;
      this.layers = this.main.layers;
      this.layers.push(this);
      if (!this.name) {
        this.name = "" + this.layers.length + "/" + this.parentLayer.childLayers.length;
      }
      this.name = this.parentLayer.name + '.' + this.name;
    } else {
      this.main = this;
      if (typeof document !== "undefined" && document !== null) {
        this.parentNode = document;
      }
      this.main.request = {};
      if (typeof window !== "undefined" && window !== null) {
        this.main.request.origin = window.location.origin || window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
      }
      this.main.request.agent = superagent;
      this.main.request.loading = {};
      this.main.request.cache = {};
      this.main.layers = [this];
      if (!this.main.name) {
        this.main.name = 'main';
      }
    }
    this.log = new Log(this);
    this.busy = {};
    this.config = {};
    this.rel = {};
  }

  return LayerController;

})(EventEmitter2);

LayerController._ = _;

LayerController.Promise = Promise;

LayerController.superagent = superagent;

LayerController.EventEmitter2 = EventEmitter2;

module.exports = LayerController;
