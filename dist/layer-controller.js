var LayerController, Log, Module, Promise, pasteHTML, superagent, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

_ = require('lodash');

Promise = require('bluebird');

superagent = require('superagent');

Module = require('./module');

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

  LayerController.prototype._conflictTask = {
    'stateAll': ['state', 'hideAll', 'hide', 'show', 'insert'],
    'state': ['hideAll', 'hide', 'show', 'insert', 'reset'],
    'hideAll': ['hide', 'show', 'insert'],
    'hide': ['show', 'insert', 'reset'],
    'show': ['hideAll', 'hide', 'insert', 'reset'],
    'insert': ['hideAll', 'hide', 'reset'],
    'load': ['reset'],
    'parse': ['reset'],
    'reset': ['hide', 'show', 'insert', 'load', 'parse']
  };

  LayerController.prototype._afterConflictTask = function(name, type) {
    var conflictTasks, task, _name, _ref, _task;
    task = this.task[name];
    if (task.run) {
      return task;
    }
    if (!((_ref = this._conflictTask[name]) != null ? _ref.length : void 0)) {
      return task;
    }
    conflictTasks = (function() {
      var _ref1, _results;
      _ref1 = this.task;
      _results = [];
      for (_name in _ref1) {
        if (!__hasProp.call(_ref1, _name)) continue;
        _task = _ref1[_name];
        if ((this._conflictTask[name].indexOf(_name) !== -1) && _task.run) {
          _results.push(_task.run);
        }
      }
      return _results;
    }).call(this);
    if (!conflictTasks.length) {
      return task;
    }
    task.run = Promise.all(conflictTasks)["catch"]().then((function(_this) {
      return function() {
        _this._deleteTask(task);
        return _this[name](type);
      };
    })(this));
    return task;
  };

  LayerController.prototype._task = function(name, type) {
    var task;
    if (!this.task[name]) {
      this.task[name] = {};
    }
    task = this.task[name];
    if (task.run) {
      if (task.type === type) {
        return task;
      }
      task.run.then((function(_this) {
        return function() {
          return _this[name](type);
        };
      })(this));
    }
    task.type = type;
    return this._afterConflictTask(name, type);
  };

  LayerController.prototype._deleteTask = function(task, fn, arg) {
    delete task.type;
    delete task.run;
    delete task.err;
    if (fn != null) {
      return fn(arg);
    }
  };

  LayerController.prototype.test = function(testValue) {
    var task;
    task = this._task('load', testValue);
    if (task.run) {
      return task.run;
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('test', testValue));
        if (testValue === 24) {
          emits.push(_this.emitAll('test.prop', testValue, 42));
        }
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
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
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!success) {
                return _this._deleteTask(task, Promise.resolve, null);
              }
            }
            return _this._deleteTask(task, Promise.resolve, _this);
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype.render = function(tpl) {
    return _.template(tpl, this);
  };

  LayerController.prototype._originPath = function(path) {
    if (this.request.origin && path.search('//') !== 0 && path.search('/') === 0) {
      path = this.request.origin + path;
    }
    return path;
  };

  LayerController.prototype._load = function(path, key, data) {
    var paths, _key, _path;
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
      path = this._originPath(path);
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
    var task;
    task = this._task('load');
    if (task.run) {
      return task.run;
    }
    if (this.data != null) {
      return Promise.resolve(this);
    }
    if (!this.download) {
      return Promise.reject(new Error(this.log.error('layer.download does not exist')));
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('load'));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          return _this._load().then(function() {
            emits = [];
            emits.push(_this.emitAll('loaded'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return _this._deleteTask(task, Promise.resolve, null);
                }
              }
              return _this._deleteTask(task, Promise.resolve, _this);
            });
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype.reparseAll = function(force) {
    return this.reparse(force).then((function(_this) {
      return function(layer) {
        return Promise.all(_this.childLayers.map(function(layer) {
          return layer.reparse(force);
        }))["catch"]().then(function() {
          return _this;
        });
      };
    })(this));
  };

  LayerController.prototype.reparse = function(force) {
    var _ref;
    if (!((_ref = this.elementList) != null ? _ref.length : void 0) || !this.isShown) {
      if (!force) {
        return Promise.resolve(null);
      }
      return this.show(true).then((function(_this) {
        return function(layer) {
          if (layer) {
            return layer;
          }
          return _this.hideAll().then(function() {
            return layer;
          });
        };
      })(this));
    }
    return this._show(true).then((function(_this) {
      return function(layer) {
        if (layer || !force) {
          return layer;
        }
        return _this.hideAll().then(function() {
          return layer;
        });
      };
    })(this));
  };

  LayerController.prototype.parse = function(force) {
    var task, _ref;
    if (force == null) {
      force = false;
    }
    task = this._task('parse', force);
    if (task.run) {
      return task.run;
    }
    if ((this.html != null) && !force) {
      return Promise.resolve(this);
    }
    if (((_ref = this.data) != null ? _ref.tpl : void 0) == null) {
      return Promise.reject(new Error(this.log.error('layer.data.tpl does not exist')));
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('parse'));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          _this.html = _this.render(_this.data.tpl);
          emits = [];
          emits.push(_this.emitAll('parsed'));
          return Promise.all(emits).then(function(emits) {
            var _j, _len1;
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!(!success)) {
                continue;
              }
              _this.html = null;
              return _this._deleteTask(task, Promise.resolve, null);
            }
            return _this._deleteTask(task, Promise.resolve, _this);
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype._make = function(force) {
    var _ref;
    if (this.download) {
      return this.load().then((function(_this) {
        return function(layer) {
          if (!layer) {
            return null;
          }
          return _this.parse(force);
        };
      })(this));
    } else {
      if (((_ref = this.data) != null ? _ref.tpl : void 0) == null) {
        return Promise.resolve(this);
      }
      return this.parse(force);
    }
  };

  LayerController.prototype.make = function(force) {
    var task;
    if (force == null) {
      force = false;
    }
    task = this._task('make', force);
    if (task.run) {
      return task.run;
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('make'));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          return _this._make(force).then(function(layer) {
            if (!layer) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
            emits = [];
            emits.push(_this.emitAll('made'));
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return _this._deleteTask(task, Promise.resolve, null);
                }
              }
              return _this._deleteTask(task, Promise.resolve, _this);
            });
          }, function(err) {
            throw task.err = err;
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
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
    if (!node) {
      throw new Error('findElements: node does not exist');
    }
    if (!selectors) {
      throw new Error('findElements: selectors does not exist');
    }
    if (node.find && node.html) {
      return node.find(selectors);
    }
    if (node.querySelectorAll) {
      return _.toArray(node.querySelectorAll(selectors));
    }
    if (!((_ref1 = node[0]) != null ? _ref1.querySelectorAll : void 0)) {
      throw new Error(this.log.error('findElements: bad node'));
    }
    elementList = [];
    for (_i = 0, _len = node.length; _i < _len; _i++) {
      element = node[_i];
      elementList = elementList.concat(_.toArray(element.querySelectorAll(selectors)));
    }
    return elementList;
  };

  LayerController.prototype.htmlElements = function(elementList, html) {
    if (!elementList) {
      throw new Error('htmlElements: elementList does not exist');
    }
    if (html == null) {
      throw new Error('htmlElements: html does not exist');
    }
    if (elementList.html) {
      return elementList.html(html);
    }
    return Array.prototype.forEach.call(elementList, function(element) {
      return pasteHTML(element, html);
    });
  };

  LayerController.prototype.insert = function(force) {
    var task;
    if (force == null) {
      force = true;
    }
    task = this._task('insert', force);
    if (task.run) {
      return task.run;
    }
    if (!this.selectors) {
      return Promise.reject(new Error(this.log.error('layer.selectors does not exist')));
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('insert'));
        if (typeof window !== "undefined" && window !== null) {
          emits.push(_this.emitAll('insert.window'));
        }
        return resolve(Promise.all(emits).then(function(emits) {
          var elementList, success, _i, _len, _ref;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          if (!(!force && ((_ref = _this.elementList) != null ? _ref.length : void 0))) {
            _this.elementList = null;
            elementList = _this.findElements();
            if (!(elementList != null ? elementList.length : void 0)) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
            _this.htmlElements(elementList, _this.html);
            _this.elementList = elementList;
          }
          emits = [];
          emits.push(_this.emitAll('domready'));
          if (typeof window !== "undefined" && window !== null) {
            emits.push(_this.emitAll('domready.window'));
          }
          return Promise.all(emits).then(function(emits) {
            var _j, _len1;
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!(!success)) {
                continue;
              }
              _this.elementList = null;
              return _this._deleteTask(task, Promise.resolve, null);
            }
            return _this._deleteTask(task, Promise.resolve, _this);
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype._show = function(force) {
    return this.make(force).then((function(_this) {
      return function(layer) {
        if (!layer) {
          return null;
        }
        return _this.insert(force);
      };
    })(this));
  };

  LayerController.prototype.show = function(force) {
    var task, _ref, _ref1;
    if (force == null) {
      force = false;
    }
    task = this._task('show', force);
    if (task.run) {
      return task.run;
    }
    if (this.isShown && ((_ref = this.elementList) != null ? _ref.length : void 0)) {
      return Promise.resolve(this);
    }
    if (!(this.parentNode || (this.parentLayer && this.parentLayer.isShown && ((_ref1 = this.parentLayer.elementList) != null ? _ref1.length : void 0)))) {
      return Promise.resolve(null);
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('show'));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          return _this._show(force).then(function(layer) {
            if (!layer) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
            emits = [];
            emits.push(_this.emitAll('shown'));
            if (typeof window !== "undefined" && window !== null) {
              emits.push(_this.emitAll('shown.window'));
            }
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return _this._deleteTask(task, Promise.resolve, null);
                }
              }
              _this.isShown = true;
              return _this._deleteTask(task, Promise.resolve, _this);
            });
          }, function(err) {
            throw task.err = err;
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype.hideAll = function(force) {
    var task, _ref;
    if (force == null) {
      force = false;
    }
    this.log.debug('hideAll', force);
    task = this._task('hideAll', force);
    if (task.run) {
      return task.run;
    }
    if (!this.isShown && !((_ref = this.elementList) != null ? _ref.length : void 0) && !force) {
      return Promise.resolve(this);
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('hide.all'));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          return Promise.all(_this.childLayers.map(function(layer) {
            return layer.hideAll(force);
          }))["catch"]().then(function() {
            return _this.hide(force).then(function() {
              emits = [];
              emits.push(_this.emitAll('hidden.all'));
              return Promise.all(emits).then(function(emits) {
                var _j, _len1;
                for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                  success = emits[_j];
                  if (!success) {
                    return _this._deleteTask(task, Promise.resolve, null);
                  }
                }
                return _this._deleteTask(task, Promise.resolve, _this);
              });
            }, function(err) {
              throw task.err = err;
            });
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype.hide = function(force) {
    var task, _ref;
    if (force == null) {
      force = false;
    }
    this.log.debug('hide', force);
    task = this._task('hide', force);
    if (task.run) {
      return task.run;
    }
    if (!this.isShown && !((_ref = this.elementList) != null ? _ref.length : void 0) && !force) {
      return Promise.resolve(this);
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('hide'));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len, _ref1;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          if (force && !((_ref1 = _this.elementList) != null ? _ref1.length : void 0)) {
            _this.htmlElements(_this.findElements(), '');
          } else {
            _this.htmlElements(_this.elementList, '');
          }
          _this.isShown = false;
          _this.elementList = null;
          emits = [];
          emits.push(_this.emitAll('hidden'));
          if (typeof window !== "undefined" && window !== null) {
            emits.push(_this.emitAll('hidden.window'));
          }
          return Promise.all(emits).then(function(emits) {
            var _j, _len1;
            for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
              success = emits[_j];
              if (!success) {
                return _this._deleteTask(task, Promise.resolve, null);
              }
            }
            return _this._deleteTask(task, Promise.resolve, _this);
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype.stateAll = function(state) {
    var task;
    if (state == null) {
      state = '';
    }
    task = this._task('stateAll', state);
    if (task.run) {
      return task.run;
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        emits = [];
        emits.push(_this.emitAll('state.all', state));
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          return _this.state(state).then(function() {
            return Promise.all(_this.childLayers.map(function(layer) {
              return layer.stateAll(state);
            }))["catch"]().then(function() {
              emits = [];
              emits.push(_this.emitAll('stated.all', state));
              return Promise.all(emits).then(function(emits) {
                var _j, _len1;
                for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                  success = emits[_j];
                  if (!success) {
                    return _this._deleteTask(task, Promise.resolve, null);
                  }
                }
                return _this._deleteTask(task, Promise.resolve, _this);
              });
            });
          }, function(err) {
            throw task.err = err;
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype._state = function(state) {
    if (!this.selectors) {
      return Promise.resolve(this);
    }
    if (!(!this.regState || (state.search(this.regState) !== -1))) {
      return this.hideAll();
    }
    return this.show();
  };

  LayerController.prototype.state = function(state) {
    var pushed, task;
    if (state == null) {
      state = '';
    }
    if (!this.task.state) {
      this.task.state = {
        queue: []
      };
    }
    task = this._afterConflictTask('state', state);
    if (task.run) {
      pushed = task.queue.push(state);
      return task.run.then((function(_this) {
        return function() {
          if (task.queue.length !== pushed) {
            return null;
          }
          task.queue = [];
          return task.run = _this.state(state);
        };
      })(this));
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        var emits;
        _this.task.state.next = state;
        _this.task.state.equal = (_this.task.state.current === _this.task.state.next ? true : false);
        _this.task.state.progress = ((_this.task.state.current != null) && !_this.task.state.equal ? true : false);
        _this.task.state.nofirst = _this.task.state.current != null;
        emits = [];
        emits.push(_this.emitAll('state', state));
        if (typeof window !== "undefined" && window !== null) {
          emits.push(_this.emitAll('state.window', state));
        }
        if (_this.task.state.nofirst) {
          emits.push(_this.emitAll('state.next', state));
        }
        if (_this.task.state.equal) {
          emits.push(_this.emitAll('state.equal', state));
          if (typeof window !== "undefined" && window !== null) {
            emits.push(_this.emitAll('state.equal.window', state));
          }
        } else {
          emits.push(_this.emitAll('state.different', state));
          if (typeof window !== "undefined" && window !== null) {
            emits.push(_this.emitAll('state.different.window', state));
          }
        }
        if (_this.task.state.progress) {
          emits.push(_this.emitAll('state.progress', state));
          if (typeof window !== "undefined" && window !== null) {
            emits.push(_this.emitAll('state.progress.window', state));
          }
        }
        return resolve(Promise.all(emits).then(function(emits) {
          var success, _i, _len;
          for (_i = 0, _len = emits.length; _i < _len; _i++) {
            success = emits[_i];
            if (!success) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
          }
          return _this._state(state).then(function(layer) {
            if (!layer) {
              return _this._deleteTask(task, Promise.resolve, null);
            }
            _this.task.state.last = _this.task.state.current;
            _this.task.state.current = state;
            delete _this.task.state.next;
            emits = [];
            emits.push(_this.emitAll('stated', state));
            if (_this.task.state.nofirst) {
              emits.push(_this.emitAll('stated.next', state));
              if (typeof window !== "undefined" && window !== null) {
                emits.push(_this.emitAll('stated.next.window', state));
              }
            }
            return Promise.all(emits).then(function(emits) {
              var _j, _len1;
              for (_j = 0, _len1 = emits.length; _j < _len1; _j++) {
                success = emits[_j];
                if (!success) {
                  return _this._deleteTask(task, Promise.resolve, null);
                }
              }
              return _this._deleteTask(task, Promise.resolve, _this);
            });
          }, function(err) {
            throw task.err = err;
          });
        }));
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype._reset = function(cacheKey) {
    var data, path, _ref;
    delete this.html;
    delete this.elementList;
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
      path = this._originPath(path);
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

  LayerController.prototype.reset = function(cacheKey) {
    var task;
    task = this._task('reset', cacheKey);
    if (task.run) {
      return task.run;
    }
    return task.run = new Promise((function(_this) {
      return function(resolve, reject) {
        return process.nextTick(function() {
          return _this._deleteTask(task, resolve, _this._reset(cacheKey));
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (task.err == null) {
          _this.log.error(err);
        }
        _this._deleteTask(task);
        throw err;
      };
    })(this));
  };

  LayerController.prototype.getFullName = function() {
    if (!this.parentLayer) {
      return this.name;
    }
    return this.parentLayer.getFullName() + '.' + this.name;
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
        this.name = "" + this.parentLayer.childLayers.length + "(" + this.layers.length + ")";
      }
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
      this.main.name = (parentLayer != null ? parentLayer.name : void 0) || this.main.name || 'main';
    }
    this.log = new Log(this);
    this.task = {};
    this.config = {};
    this.rel = {};
    LayerController.emit("init." + (this.getFullName()), this);
  }

  return LayerController;

})(Module);

LayerController._ = _;

LayerController.Promise = Promise;

LayerController.superagent = superagent;

LayerController.pasteHTML = pasteHTML;

LayerController.Log = Log;

module.exports = LayerController;

LayerController.Module = Module;

LayerController.EventEmitter2 = Module.EventEmitter2;

LayerController.extend(new Module.EventEmitter2({
  wildcard: true
}));
