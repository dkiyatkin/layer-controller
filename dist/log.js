var Log, colour,
  __slice = [].slice;

colour = require('colour');

colour.setTheme({
  DEBUG: 'blue',
  INFO: 'green',
  WARN: 'yellow',
  ERROR: 'red bold'
});

Log = (function() {
  Log.prototype._log = function(msg, level) {
    var colorLog, log;
    msg = msg.join(' ');
    log = "[" + (new Date().toISOString()) + "] " + this.levels[level] + " layer " + (this.layer.getFullName()) + ": " + msg;
    if (typeof window === "undefined" || window === null) {
      colorLog = log[this.levels[level]];
    }
    if (this.levels.indexOf(this.level) <= level) {
      (console[this.levels[level].toLowerCase()] || console.log).call(console, colorLog || log);
    }
    this.history += log + '\n';
    return log;
  };

  Log.prototype.levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

  Log.prototype.debug = function() {
    var msg;
    msg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return this._log(msg, 0);
  };

  Log.prototype.info = function() {
    var msg;
    msg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return this._log(msg, 1);
  };

  Log.prototype.warn = function() {
    var msg;
    msg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return this._log(msg, 2);
  };

  Log.prototype.error = function() {
    var msg;
    msg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return this._log(msg, 3);
  };

  function Log(layer) {
    this.layer = layer;
    this.level = 'DEBUG';
    this.history = '';
  }

  return Log;

})();

Log.colour = colour;

module.exports = Log;
