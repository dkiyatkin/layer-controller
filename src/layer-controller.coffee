_ = require('lodash')
Promise = require('bluebird')
superagent = require('superagent')
EventEmitter2 = require('eventemitter2').EventEmitter2
pasteHTML = require('./pasteHTML')
Log = require('./log')

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
        @log.debug('test action')
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
  # @param {String} tpl Шаблон
  # @return {String} text Готовый текст
  render: (tpl) ->
    _.template(tpl, this)

  # Загрузить данные для слоя
  # @param {String|Arrya|Object} path данные для загрузки
  # @param {Object} data Объект для сохранения
  # @param {?String} key Ключ по которому будут сохранены данные
  # @return {?Promise} data
  _load: (path, key, data) ->
    @log.debug('_load', path, key, data)
    @data = {} if not @data
    @_data = {} if not @_data
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
        @request.loading[path].set('x-layer-controller-proxy', 'true') # защита от рекурсии
        @request.loading[path] = Promise.promisify(@request.loading[path].end, @request.loading[path])()

      @request.loading[path].then (res) =>
        delete @request.loading[path]
        if res.error
          @log.error("load #{path}:", res.error?.message or res.error)
          return
        if res.body and Object.keys(res.body).length
          @request.cache[path] = res.body
        else
          @request.cache[path] = res.text
        @_data[path] = @request.cache[path]
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
    return Promise.resolve(this) if @data?
    return Promise.reject(new Error("layer.download does not exist: #{@name}")) if not @download

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

  # Перерисовать слой
  # @param {Boolean} childLayers Перерисовать все дочерние слои
  # @return {Promise} layer
  reparse: (childLayers = true) ->
    _all = []
    if childLayers
      for _layer in @childLayers
        _all.push(_layer.reparse(childLayers))

    Promise.all(_all).then (layers) => # перепарсить дочерние слои сначала
      @make().then (layer) =>
        return null if not layer
        @insert()

  # Распарсить шаблон (layer.data.tpl) слоя в html (layer.html), если уже распарсен, то ничего не делать
  # @return {Promise} layer
  parse: ->
    return @busy.parse if @busy.parse
    return Promise.resolve(this) if @html?
    return Promise.reject(new Error("layer.data.tpl does not exist: #{@name}")) if not @data?.tpl?

    @busy.parse = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('parse'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.parse
          return resolve(null)
        @html = @render(@data.tpl)
        emits = []
        emits.push(@emitAll('parsed'))

        Promise.all(emits).then (emits) =>
          delete @busy.parse
          for success in emits when not success
            @html = null # XXX нужно ли это?
            return resolve(null)
          resolve(this)

      .then null, (err) =>
        delete @busy.parse
        reject(err)

  # Загрузить, распарсить слой
  # @return {Promise} layer
  _make: -> # load parse
    if @download
      @load().then (layer) =>
        return null if not layer
        # return this if not @data?.tpl?
        @parse()

    else
      return Promise.resolve(this) if not @data?.tpl?
      @parse()

  # Загрузить, распарсить слой
  # @return {Promise} layer
  make: ->
    return @busy.make if @busy.make

    @busy.make = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('make'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.make
          return resolve(null)

        @_make().then (layer) =>
          if not layer
            delete @busy.make
            return resolve(null)
          emits = []
          emits.push(@emitAll('made'))

          Promise.all(emits).then (emits) =>
            delete @busy.make
            for success in emits when not success
              return resolve(null)
            resolve(this)

      .then null, (err) =>
        delete @busy.make
        reject(err)

  # Найти список элементов
  # @param {Node|NodeList} node
  # @param {String} selectors
  # @return {?NodeList} elementList
  findElements: (node = @parentNode or @parentLayer?.elementList, selectors = @selectors) -> # XXX null vs error vs [], elementList vs isShown
    @log.debug 'findElements' #, node, selectors
    return null if not node or not selectors
    return node.find(selectors) if node.find and node.html # у массивов может быть свой find
    return node.querySelectorAll(selectors) if node.querySelectorAll
    return null if not node[0]?.querySelectorAll
    elementList = []
    for element in node
      elementList = elementList.concat(_.toArray(element.querySelectorAll(selectors)))
    elementList

  # Вставить html в список элементов
  # @param {NodeList} elementList
  # @param {String} html
  htmlElements: (elementList, html = '') ->
    return elementList.html(html) if elementList.html
    Array::forEach.call elementList, (element) ->
      pasteHTML(element, html) # element.innerHTML = @html

  # Вставить слой, нет обработки если слой заместит какой-то другой слой
  # @param {Boolean} force Вставлять слой даже если уже есть @elementList
  # @return {Promise} layer
  insert: (force = true) ->
    return @busy.insert if @busy.insert
    return Promise.reject(new Error(@log.error('layer.selectors does not exist'))) if not @selectors

    @busy.insert = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('insert'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.insert
          return resolve(null)
        if not (not force and @elementList?.length)
          @elementList = null
          elementList = @findElements()
          if not elementList?.length
            delete @busy.insert
            return resolve(null)
          @htmlElements(elementList, @html)
          @elementList = elementList
        emits = []
        emits.push(@emitAll('inserted'))
        emits.push(@emitAll('domready'))

        Promise.all(emits).then (emits) =>
          delete @busy.insert
          for success in emits when not success
            # @elementList = null # XXX нужно ли это? # hide может перестать работать
            return resolve(null)
          resolve(this)

      .then null, (err) =>
        delete @busy.insert
        reject(err)

  # Приготовить, вставить если нужно
  # @param {Boolean} childLayers
  # @return {Promise} layer
  _show: (childLayers) ->
    @make().then (layer) =>
      return null if not layer
      return @insert(!@elementList?.length) if not childLayers

      @insert(!@elementList?.length).then (layer) =>
        return null if not layer
        _all = []
        for _layer in @childLayers
          _all.push(_layer.show(childLayers))

        Promise.all(_all).then (layers) => # показать дочерние слои потом
          this

  # Показать слой (загрузить, распарсить, вставить), если он не показан. Если слой показан, ничего не делать
  # @param {Boolean} childLayers XXX возможно здесь это ни к чему
  # @return {Promise} layer
  show: (childLayers) ->
    return @busy.show if @busy.show
    return Promise.resolve(this) if @isShown

    @busy.show = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('show'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.show
          return resolve(null)

        @_show(childLayers).then (layer) =>
          if not layer
            delete @busy.show
            return resolve(null)
          emits = []
          emits.push(@emitAll('showed'))
          emits.push(@emitAll('shown'))

          Promise.all(emits).then (emits) =>
            delete @busy.show
            for success in emits when not success
              return resolve(null)
            @isShown = true
            resolve(this)

      .then null, (err) =>
        delete @busy.show
        reject(err)

  # Скрыть слой
  # @param {Boolean} childLayers Скрыть все дочерние слои
  # @return {Promise} layer
  _hide: (childLayers = true) ->
    if not childLayers
      @htmlElements(@elementList, '')
      return Promise.resolve(this)
    _all = []
    for _layer in @childLayers
      _all.push(_layer.hide(childLayers))

    Promise.all(_all).then (layers) =>
      @htmlElements(@elementList, '')
      this

  # Скрыть слой
  # @param {Boolean} childLayers Скрыть все дочерние слои
  # @return {Promise} layer
  hide: (childLayers = true) ->
    return @busy.hide if @busy.hide
    Promise.resolve(this) if not @isShown and not @elementList

    @busy.hide = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('hide'))

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.hide
          return resolve(null)

        @_hide(childLayers).then (layer) =>
          if not layer
            delete @busy.hide
            return resolve(null)
          @isShown = false
          @elementList = null
          emits = []
          emits.push(@emitAll('hidden'))

          Promise.all(emits).then (emits) =>
            delete @busy.hide
            for success in emits when not success
              return resolve(null)
            resolve(this)

      .then null, (err) =>
        delete @busy.hide
        reject(err)

  # Скрыть или показать слой в зависимости от состояния layer.regState
  # @param {String} state Состояние для слоя
  # @param {Boolean} childLayers
  # @return {Promise} layer
  _state: (state, childLayers) ->
    return Promise.resolve(this) if not @selectors # XXX @selectors не очень очевидно
    if not @regState or (state.search(@regState) != -1)
      # delete @isShown # XXX нужно или нет?
      return @show() if not childLayers

      @show().then (layer) =>
        return null if not layer
        _all = []
        for _layer in @childLayers
          _all.push(_layer.state(state, childLayers))

        Promise.all(_all).then (layers) => # не важно если не все покажутся
          this

    else
      @hide(childLayers)

  # Привести слой к состоянию
  # @param {String} state Состояние для слоя
  # @param {Boolean} childLayers
  # @return {Promise} layer
  state: (state = '', childLayers) ->
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
      @state.progress = (if @state.current? and not @state.equal then true else false)
      emits = []
      emits.push(@emitAll('state'))
      emits.push(@emitAll('state.next')) if @state.current? # не в первый раз

      Promise.all(emits).then (emits) =>
        for success in emits when not success
          delete @busy.state.run
          return resolve(null)

        @_state(state, childLayers).then (layer) =>
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

  # Очистка слоя от временных данных
  # @param {String|Boolean} cacheKey
  # @return {Boolean} success
  reset: (cacheKey) ->
    delete @html
    # delete @elementList # hide может перестать работать
    delete @data
    return true if not cacheKey
    return false if not @_data or not @download
    if _.isString(cacheKey)
      path = @render(@download[cacheKey])
      return false if not path
      delete @_data[path]
      delete @request.cache[path]
      return true
    if _.isBoolean(cacheKey) # удалить все связанные загрузки
      for own path, data of @_data
        delete @_data[path]
        delete @request.cache[path]
      return true
    false

  constructor: (parentLayer) ->
    super wildcard: true
    @childLayers = []
    if parentLayer instanceof LayerController # определение layer.main
      @parentLayer = parentLayer
      @parentLayer.childLayers.push(this)
      @main = parentLayer.main
      @request = @main.request
      @layers = @main.layers
      @layers.push(this)
      @name = "#{@layers.length}/#{@parentLayer.childLayers.length}" if not @name
      @name = @parentLayer.name + '.' + @name
    else # main слой без parentLayer
      @main = this
      @parentNode = document if document?
      @main.request = {}
      if window?
        @main.request.origin = # на сервере origin определяется по своему
          window.location.origin or window.location.protocol + '//' + window.location.hostname + (if window.location.port then ':' + window.location.port else '')
      @main.request.agent = superagent
      @main.request.loading = {} # загружаемые адреса и их Promise
      @main.request.cache = {}
      @main.layers = [this]
      @main.name = 'main' if not @main.name
    @log = new Log(this)
    @busy = {}
    @config = {}
    @rel = {}

LayerController._ = _
LayerController.Promise = Promise
LayerController.superagent = superagent
LayerController.EventEmitter2 = EventEmitter2
module.exports = LayerController
