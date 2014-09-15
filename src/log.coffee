# Сообщения для отладки и для ошибок

class Log
  # @param {Array} msg
  # @param {Number} level
  # @return {String} log
  _log: (msg, level) ->
    msg = msg.join(' ')
    log = "[#{new Date().toISOString()}] #{@levels[level]} layer #{@layer.name}: #{msg}"
    if @levels.indexOf(@level) <= level
      (console[@levels[level].toLowerCase()] or console.log)(log) # console.debug nodejs нету
    @history += log + '\n'
    log

  # Уровни сообщиний, используются как console[levels[level].toLowerCase()]
  levels: ['DEBUG', 'INFO', 'WARN', 'ERROR']

  # @param {...*} msg
  # @return {String} log
  debug: (msg...) -> @_log(msg, 0)

  # @param {...*} msg
  # @return {String} log
  info: (msg...) -> @_log(msg, 1)

  # @param {...*} msg
  # @return {String} log
  warn: (msg...) -> @_log(msg, 2)

  # @param {...*} msg
  # @return {String} log
  error: (msg...) -> @_log(msg, 3)

  constructor: (@layer) ->
    @level = 'DEBUG'
    @history = ''

module.exports = Log
