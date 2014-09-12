_ = require('lodash')
Promise = require('bluebird')
superagent = require('superagent')
EventEmitter2 = require('eventemitter2').EventEmitter2

class LayerController extends EventEmitter2
  # Выполнить все события
  # @param {String} event
  # @param {*} args
  # @return {?Promise} layer
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

  # Тестовый метод слоя, ничего не делает
  # События
  # Несколько одновременных запусков запустят одну работу на всех
  # @return {?Promise} layer
  test: (testValue) ->
    @busy.test = {} if not @busy.test
    return @busy.test[testValue] if @busy.test[testValue]

    @busy.test[testValue] = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('test', testValue))
      emits.push(@emitAll('test.prop', testValue, 42)) if testValue is 24

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.test[testValue]
          return resolve(null)
        @testCount = 0 if not @testCount?
        @testCount++
        # console.log 'test action'
        emits = []
        emits.push(@emitAll('tested', testValue))
        emits.push(@emitAll('tested.prop', testValue, 42)) if testValue is 24

        Promise.all(emits).then (emits) =>
          delete @busy.test[testValue]
          for success in emits when not success
            return resolve(null)
          resolve(this)

      .then null, (err) =>
        delete @busy.test[testValue]
        reject(err)

  # Рендер шаблона
  render: (tpl = '') ->
    tpl = tpl + ''
    # return mustache.render(tpl, @) if tpl.indexOf('{{') >= 0
    tpl

  # Загрузить данные для слоя
  # @param {String|Arrya|Object} path данные для загрузки
  # param {Object} data Объект для сохранения
  # param {?String} key Ключ по которому будут сохранены данные
  # @return {?Promise} data
  _load: (path, key, data) ->
    @data = {} if not @data
    if not path
      path = @download
      data = @data
      key = 'tpl'
    if key? and not data
      data = @data
    if _.isString(path)
      path = @render(path)
      if @request.origin and path.search('//') isnt 0 and path.search('/') is 0 # относительные пути не поддерживаются
        path = @request.origin + path
      if @request.cache[path]
        return Promise.resolve(@request.cache[path]) if not (key? and data)
        data[key] = @request.cache[path]
        return Promise.resolve(data)
      if not @request.loading[path]
        @request.loading[path] = @request.agent.get(path)
        @request.loading[path].set(@request.headers) if @request.headers
        @request.loading[path] = Promise.promisify(@request.loading[path].end, @request.loading[path])()

      @request.loading[path].then (res) =>
        delete @request.loading[path]
        if res.body and Object.keys(res.body).length
          @request.cache[path] = res.body
        else
          @request.cache[path] = res.text
        return @request.cache[path] if not (key? and data)
        data[key] = @request.cache[path]
        return data

    else if _.isArray(path)
      Promise.each path, (item, i, value) =>
        @_load(item, i, data)

      .then (results) ->
        data

    else if _.isObject(path)
      paths = []
      for own _key, _path of path
        if _.isObject(_path)
          data[_key] = {}
          paths.push(@_load(_path, _key, data[_key]))
        else
          paths.push(@_load(_path, _key, data))

      Promise.all(paths).then ->
        data

  # Загрузить (layer.download) данные (layer.data) слоя, если они еще не загружены или загрузить один файл
  # Данные кэшируются в layer.request.cache
  # @return {?Promise} layer
  load: ->
    return @busy.load if @busy.load

    @busy.load = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('load'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.load
          return resolve(null)

        @_load().then =>
          emits = []
          emits.push(@emitAll('loaded'))

          Promise.all(emits).then (emits) =>
            delete @busy.load
            for success in emits when not success
              return resolve(null)
            resolve(this)

      .then null, (err) =>
        delete @busy.load
        reject(err)

  parse: ->
  reparse: ->

  # Загрузить, распарсить слой. Приготовить для вставки
  # @return {Promise} layer
  make: -> # load parse
    Promise.resolve(this)

  # Вставить слой
  # @return {Promise} layer
  insert: ->
    Promise.resolve(this)

  # Показать слой (загрузить, распарсить, вставить), если он не показан. Если слой показан, ничего не делать
  # @return {Promise} layer
  show: ->
    return Promise.resolve(this) if @isShown
    return @busy.show if @busy.show

    @busy.show = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('show'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.show
          return resolve(null)

        @make().then (layer) =>
          if not layer
            delete @busy.show
            return resolve(null)

          @insert().then (layer) =>
            if not layer
              delete @busy.show
              return resolve(null)
            emits = []
            emits.push(@emitAll('shown'))

            Promise.all(emits).then (emits) =>
              for success in emits when not success
                delete @busy.show
                return resolve(null)
              @isShown = true
              resolve(this)

      .then null, (err) =>
        delete @busy.show
        reject(err)

  # Скрыть слой, не скрывает дочерние слои, их нужно скрывать вручную в первую очередь
  # @return {Promise} layer
  hide: ->
    delete @isShown
    Promise.resolve(this)

  # Скрыть или показать слой в зависимости от состояния layer.regState
  # @return {Promise} layer
  _state: (state) ->
    if not @regState or (state.search(@regState) != -1)
      delete @isShown
      @show()
    else
      @hide()

  # Привести слой к состоянию
  # @param {String} state Состояние для слоя
  # @return {Promise} layer
  state: (state = '') ->
    @busy.state = {queue: []} if not @busy.state
    if @busy.state.run # если уже идет state
      pushed = @busy.state.queue.push(state)

      return @busy.state.run.then => # выполнить state(), если это последний в очереди
        return null if @busy.state.queue.length isnt pushed
        @busy.queue = [] # очищаем массив
        @busy.state.run = @state(state)

    @busy.state.run = new Promise (resolve, reject) =>
      @state.next = state
      @state.equal = (if @state.current is @state.next then true else false)
      @state.progress = (if @state.current and not @state.equal then true else false)
      emits = []
      emits.push(@emitAll('state'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.state.run
          return resolve(null)

        @_state(state).then (layer) =>
          if not layer # слой не вставился
            delete @busy.state.run
            return resolve(null)
          @state.last = @state.current
          @state.current = state
          delete @state.next
          emits = []
          emits.push(@emitAll('stated'))

          Promise.all(emits).then (emits) =>
            delete @busy.state.run
            for success in emits when not success
              return resolve(null)
            resolve(this)

      .then null, (err) =>
        delete @busy.state.run
        reject(err)

  # Очистка данных слоя
  # @param {String|Boolean} cacheKey
  reset: (cacheKey) ->

  constructor: (parentLayer) ->
    super wildcard: true
    if parentLayer instanceof LayerController # определение @main
      @main = parentLayer.main
      @request = @main.request
      @layers = @main.layers
    else # main слой без parentLayer
      @main = this
      @main.request = {}
      @main.request.agent = superagent.agent()
      @main.request.loading = {} # загружаемые адреса и их Promise
      @main.request.cache = {}
      @main.layers = []
    @layers.push(this)
    @busy = {}
    @config = {}
    @rel = {}

LayerController._ = _
LayerController.Promise = Promise
LayerController.superagent = superagent
LayerController.EventEmitter2 = EventEmitter2
module.exports = LayerController
