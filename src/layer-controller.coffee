_ = require('lodash')
Promise = require('bluebird')
superagent = require('superagent')
Module = require('./module')
pasteHTML = require('./pasteHTML')
Log = require('./log')

class LayerController extends Module
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

  # Определить задание, только разные задания могут выполнятся одновременно
  # Одни задания разного типа выполняются друг за другом
  # Задания одного типа второй раз не выполняются, а возвращают результат предыдущего задания, когда оно завершится
  # @param {String} name Имя функции, задание
  # @param {*} type Аргумент для функции, тип задания
  # @return {Object} task Если есть task[name].run, то задание с этим именем выполняется, тип задания task[name].type
  _task: (name, type) ->
    @task[name] = {} if not @task[name]
    task = @task[name]
    if task.run # есть выполнение
      return task if task.type is type
      task.run.then => @[name](type)
    task.type = type
    task

  # Завершить задание
  # @param {Object} task
  # @param {Function} fn resolve/reject
  # @param {*} arg
  # @return {Resolve|Reject} fn(arg)
  _deleteTask: (task, fn, arg) ->
    delete task.type
    delete task.run
    fn(arg)

  # Тестовый метод слоя, ничего не делает
  # События
  # Несколько одновременных запусков запустят одну работу на всех
  # @return {?Promise} layer
  test: (testValue) ->
    task = @_task('load', testValue)
    return task.run if task.run

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('test', testValue))
      emits.push(@emitAll('test.prop', testValue, 42)) if testValue is 24

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success
        @testCount = 0 if not @testCount?
        @testCount++
        @log.debug('test action')
        emits = []
        emits.push(@emitAll('tested', testValue))
        emits.push(@emitAll('tested.prop', testValue, 42)) if testValue is 24

        Promise.all(emits).then (emits) =>
          return @_deleteTask(task, resolve, null) for success in emits when not success
          @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Рендер шаблона
  # @param {String} tpl Шаблон
  # @return {String} text Готовый текст
  render: (tpl) ->
    _.template(tpl, this)

  # Загрузить данные для слоя
  # @param {String|Array|Object} path данные для загрузки
  # @param {Object} data Объект для сохранения
  # @param {?String} key Ключ по которому будут сохранены данные
  # @return {?Promise} data
  _load: (path, key, data) ->
    # @log.debug('_load', path, key, data)
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
    task = @_task('load')
    return task.run if task.run
    return Promise.resolve(this) if @data?
    return Promise.reject(new Error(@log.error('layer.download does not exist'))) if not @download

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('load'))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        @_load().then =>
          emits = []
          emits.push(@emitAll('loaded'))

          Promise.all(emits).then (emits) =>
            return @_deleteTask(task, resolve, null) for success in emits when not success
            @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Перерисовать всех потомков слоя и затем сам слой
  # @return {Promise} layer
  reparseAll: ->
    Promise.all(@childLayers.map (layer) -> layer.reparse()).catch(@log.error).finally => # перепарсить дочерние слои сначала
      @reparse()

  # Перерисовать слой
  # @return {Promise} layer
  reparse: -> @_show(true)

  # Распарсить шаблон (layer.data.tpl) слоя в html (layer.html)
  # @param {Boolean} force Парсить даже если есть layer.html
  # @return {Promise} layer
  parse: (force = false) ->
    task = @_task('parse', force)
    return task.run if task.run
    return Promise.resolve(this) if @html? and not force
    return Promise.reject(new Error(@log.error('layer.data.tpl does not exist'))) if not @data?.tpl?

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('parse'))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success
        @html = @render(@data.tpl)
        emits = []
        emits.push(@emitAll('parsed'))

        Promise.all(emits).then (emits) =>
          for success in emits when not success
            @html = null # XXX нужно ли это?
            return @_deleteTask(task, resolve, null)
          @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Загрузить, распарсить слой
  # @param {Boolean} force
  # @return {Promise} layer
  _make: (force) -> # load parse
    if @download
      @load().then (layer) =>
        return null if not layer
        # return this if not @data?.tpl?
        @parse(force)

    else
      return Promise.resolve(this) if not @data?.tpl?
      @parse(force)

  # Загрузить, распарсить слой
  # @param {Boolean} force
  # @return {Promise} layer
  make: (force = false) ->
    task = @_task('make', force)
    return task.run if task.run

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('make'))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        @_make(force).then (layer) =>
          return @_deleteTask(task, resolve, null) if not layer
          emits = []
          emits.push(@emitAll('made'))

          Promise.all(emits).then (emits) =>
            return @_deleteTask(task, resolve, null) for success in emits when not success
            @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Найти список элементов, если аргументы не переданы ищет список элементов слоя
  # @param {Node|NodeList} node
  # @param {String} selectors
  # @return {NodeList|Array} elementList
  findElements: (node = @parentNode or @parentLayer?.elementList, selectors = @selectors) ->
    @log.debug 'findElements' #, node, selectors
    throw new Error(@log.error('findElements: node does not exist')) if not node
    throw new Error(@log.error('findElements: selectors does not exist')) if not selectors
    return node.find(selectors) if node.find and node.html # у массивов может быть свой find
    return _.toArray(node.querySelectorAll(selectors)) if node.querySelectorAll
    throw new Error(@log.error('findElements: bad node')) if not node[0]?.querySelectorAll
    elementList = []
    for element in node
      elementList = elementList.concat(_.toArray(element.querySelectorAll(selectors)))
    elementList

  # Вставить html в список элементов
  # @param {NodeList} elementList
  # @param {String} html
  htmlElements: (elementList, html) ->
    throw new Error(@log.error('htmlElements: elementList does not exist')) if not elementList
    throw new Error(@log.error('htmlElements: html does not exist')) if not html
    return elementList.html(html) if elementList.html

    Array::forEach.call elementList, (element) ->
      pasteHTML(element, html) # element.innerHTML = @html

  # Вставить слой, нет обработки если слой заместит какой-то другой слой
  # @param {Boolean} force Вставлять слой даже если уже есть @elementList
  # @return {Promise} layer
  insert: (force = true) ->
    task = @_task('insert', force)
    return task.run if task.run
    return Promise.reject(new Error(@log.error('layer.selectors does not exist'))) if not @selectors

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('insert'))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success
        unless not force and @elementList?.length
          @elementList = null
          elementList = @findElements()
          return @_deleteTask(task, resolve, null) if not elementList?.length
          @htmlElements(elementList, @html)
          @elementList = elementList
        emits = []
        # emits.push(@emitAll('inserted'))
        emits.push(@emitAll('domready'))
        # emits.push(@emitAll('inserted.window')) if window?
        emits.push(@emitAll('domready.window')) if window?

        Promise.all(emits).then (emits) =>
          for success in emits when not success
            @elementList = null
            return @_deleteTask(task, resolve, null)
          @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Приготовить, вставить если нужно
  # @return {Promise} layer
  _show: (force) ->
    @make(force).then (layer) => # false - не парсить если уже есть html
      return null if not layer
      @insert(force) # false - не вставлять слой если уже есть elementList

  # Показать слой (загрузить, распарсить, вставить), если он не показан. Если слой показан, ничего не делать
  # @param {Boolean} force Парсить если уже есть html, вставлять слой если уже есть elementList
  # @return {Promise} layer
  show: (force = false) ->
    task = @_task('show', force)
    return task.run if task.run
    return Promise.resolve(this) if @isShown and @elementList?.length

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('show'))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        @_show(force).then (layer) =>
          return @_deleteTask(task, resolve, null) if not layer
          emits = []
          # emits.push(@emitAll('showed'))
          emits.push(@emitAll('shown'))

          Promise.all(emits).then (emits) =>
            return @_deleteTask(task, resolve, null) for success in emits when not success
            @isShown = true
            @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Скрыть все дочерние слои начиная с последнего и затем скрыть сам слой
  # @param {Boolean} force Пытаться скрыть даже если слой уже скрыт
  # @return {Promise} layer
  hideAll: (force = false) ->
    task = @_task('hideAll', force)
    return task.run if task.run

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('hide.all', state))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        Promise.all(@childLayers.map (layer) -> layer.hideAll(force)).catch(@log.error).finally =>
          @hide(force).then =>
            emits = []
            emits.push(@emitAll('hidden.all', state))

            Promise.all(emits).then (emits) =>
              return @_deleteTask(task, resolve, null) for success in emits when not success
              @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Скрыть слой
  # @param {Boolean} force Пытаться скрыть даже если слой уже скрыт, и заново найти layer.elementList если его нету
  # @return {Promise} layer
  hide: (force = false) ->
    task = @_task('hide', force)
    return task.run if task.run
    Promise.resolve(this) if not @isShown and not @elementList?.length and not force

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('hide'))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        if force and not @elementList?.length
          @htmlElements(@findElements(), '')
        else
          @htmlElements(@elementList, '')
        @isShown = false
        @elementList = null
        emits = []
        emits.push(@emitAll('hidden'))

        Promise.all(emits).then (emits) =>
          return @_deleteTask(task, resolve, null) for success in emits when not success
          @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Привести слой к состоянию и рекурсивно привести все дочерние слои к состоянию
  # @param {String} state Состояние для слоя
  # @return {Promise} layer
  stateAll: (state = '') ->
    task = @_task('stateAll', state)
    return task.run if task.run

    task.run = new Promise (resolve, reject) =>
      emits = []
      emits.push(@emitAll('state.all', state))

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        @state(state).then =>
          Promise.all(@childLayers.map (layer) -> layer.stateAll(state)).catch(@log.error).finally =>
            emits = []
            emits.push(@emitAll('stated.all', state))

            Promise.all(emits).then (emits) =>
              return @_deleteTask(task, resolve, null) for success in emits when not success
              @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Скрыть или показать слой в зависимости от состояния layer.regState
  # @param {String} state Состояние для слоя
  # @return {Promise} layer
  _state: (state) ->
    return Promise.resolve(this) if not @selectors # XXX layer.selectors не очень очевидно
    return @hideAll() unless not @regState or (state.search(@regState) != -1)
    # delete @isShown # XXX нужно или нет?
    @show()

  # Привести слой к состоянию
  # @param {String} state Состояние для слоя
  # @return {Promise} layer
  state: (state = '') ->
    @log.debug('state', state)
    @task.state = {queue: []} if not @task.state
    task = @task.state
    if task.run # если уже идет state
      pushed = task.queue.push(state)

      return task.run.then => # выполнить state(), если это последний в очереди
        return null if task.queue.length isnt pushed
        task.queue = [] # очищаем массив
        task.run = @state(state)

    task.run = new Promise (resolve, reject) =>
      @log.debug('state run')
      @task.state.next = state
      @task.state.equal = (if @task.state.current is @task.state.next then true else false)
      @task.state.progress = (if @task.state.current? and not @task.state.equal then true else false)
      emits = []
      emits.push(@emitAll('state', state))
      emits.push(@emitAll('state.next', state)) if @task.state.current? # не в первый раз
      emits.push(@emitAll('state.different', state)) if not @task.state.equal # состояния разные
      emits.push(@emitAll('state.progress', state)) if @task.state.progress # не в первый раз и состояния разные

      Promise.all(emits).then (emits) =>
        return @_deleteTask(task, resolve, null) for success in emits when not success

        @_state(state).then (layer) =>
          return @_deleteTask(task, resolve, null) if not layer # слой не вставился или не скрылся
          @task.state.last = @task.state.current
          @task.state.current = state
          delete @task.state.next
          emits = []
          emits.push(@emitAll('stated', state))

          Promise.all(emits).then (emits) =>
            return @_deleteTask(task, resolve, null) for success in emits when not success
            @_deleteTask(task, resolve, this)

      .catch (err) =>
        @log.error(err)
        @_deleteTask(task, reject, err)

  # Очистка слоя от временных данных
  # @param {String|Boolean} cacheKey
  # @return {Boolean} success
  reset: (cacheKey) ->
    delete @html
    delete @elementList # слой может быть isShown, но elementList сбрасываем
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

  # Получить полное имя слоя
  # @return {String} name
  getFullName: ->
    return @name if not @parentLayer
    @parentLayer.getFullName() + '.' + @name

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
    else # main слой без parentLayer
      @main = this
      @parentNode = document if document?
      @main.request = {}
      if window?
        @main.request.origin = # на сервере origin определяется по своему
          window.location.origin or
            window.location.protocol + '//' + window.location.hostname +
            (if window.location.port then ':' + window.location.port else '')
      @main.request.agent = superagent
      @main.request.loading = {} # загружаемые адреса и их Promise
      @main.request.cache = {}
      @main.layers = [this]
      @main.name = parentLayer?.name or @main.name or 'main'
    @log = new Log(this)
    @log.debug('new')
    @task = {}
    @config = {}
    @rel = {}
    LayerController.emit("init.#{@getFullName()}", this)

LayerController._ = _
LayerController.Promise = Promise
LayerController.superagent = superagent
LayerController.pasteHTML = pasteHTML
LayerController.Log = Log
module.exports = LayerController
LayerController.Module = Module
LayerController.EventEmitter2 = Module.EventEmitter2
LayerController.extend(new Module.EventEmitter2({wildcard: true})) # делаем сам класс эмиттером
