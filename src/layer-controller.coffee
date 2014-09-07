_ = require('lodash')
Promise = require('bluebird')
request = require('superagent')
EventEmitter2 = require('eventemitter2').EventEmitter2

class LayerController extends EventEmitter2
  # maxListeners: 40

  # Выполнить все события
  # @param {String} event
  # @param {*} args
  # @return {Promise} layer
  emitAll: (event, args...) -> new Promise (resolve, reject) =>
    counter = @listeners(event).length
    return resolve(true) if not counter
    stop = false

    args.unshift event, (abort) -> # done(abort)
      return if stop
      if abort? # true и другие положительные не влияют
        if abort instanceof Error
          stop = true
          return reject(abort)
        if not abort
          stop = true
          return resolve(null)
      resolve(true) if --counter is 0

    @emit.apply(this, args)

  # Тестовый метод слоя, ничего не делает, только события
  # @return {Promise} layer
  test: (testValue) -> new Promise (resolve, reject) =>
    emits = []
    emits.push(@emitAll('test', testValue))
    emits.push(@emitAll('test.prop', testValue, 42)) if testValue is 24

    Promise.all(emits).then (emits) =>
      for success in emits
        return resolve(null) if not success
      console.log 'test action'
      emits2 = []
      emits.push(@emitAll('tested', testValue))
      emits.push(@emitAll('tested.prop', testValue, 42)) if testValue is 24

      Promise.all(emits2).then (emits) =>
        for success in emits
          return resolve(null) if not success
        resolve(this)

    .then null, reject

  load: ->
  parse: ->
  reparse: ->
  make: -> # load parse
  insert: ->
  show: ->

  # Скрыть слой и все его дочерние слои
  # @return {Promise} layer
  hide: ->

  # Привести слой к состоянию
  # @param {String} state Состояние для слоя
  # @return {Promise} layer
  state: (state) ->

  # Очистка данных слоя
  # @param {String|Boolean} cacheKey
  reset: (cacheKey) ->

  constructor: (parentLayer) ->
    super wildcard: true
    if parentLayer instanceof LayerController # определение @main
      @main = parentLayer.main
    else # первый слой без parentLayer
      @main = this
      @main.cache = {}
    @config = {}
    @rel = {}
    @cache = @main.cache

module.exports = LayerController