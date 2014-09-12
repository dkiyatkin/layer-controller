# Продвинутая вставка html на страницу вместе со стилями и скриптам. Аналог jQuery.html()

# XMLHttpRequest - иксмлхэттэпэреквест
createRequestObject = () ->
  unless XMLHttpRequest?
    ->
      try
        return new ActiveXObject("Msxml2.XMLHTTP.6.0")
      try
        return new ActiveXObject("Msxml2.XMLHTTP.3.0")
      try
        return new ActiveXObject("Msxml2.XMLHTTP")
      try
        return new ActiveXObject("Microsoft.XMLHTTP")
      throw new Error("This browser does not support XMLHttpRequest.")
  else new XMLHttpRequest()

# Загрузить данные
# @param {string} url Путь для загрузки
# @param {function|undefined} cb
# @param {object|undefined} cb.err
# @param {object|undefined} cb.data
get = (url, cb) ->
  req = new createRequestObject()
  url = encodeURI(url)
  req.open "GET", url, true
  req.setRequestHeader 'If-Modified-Since', 'Sat, 1 Jan 2005 00:00:00 GMT'
  req.setRequestHeader 'X-Requested-With', 'XMLHttpRequest'
  req.onreadystatechange = ->
    if req.readyState is 4
      if req.status is 200
        cb null, req.responseText if cb?
      else
        err = Error(req.statusText)
        cb err if cb?
  req.send null

# Выполнить js
globalEval = (data) ->
  script = document.createElement("script")
  script.type = "text/javascript"
  script.text = data
  $head = document.querySelectorAll('head')[0]
  $head.insertBefore script, $head.firstChild
  $head.removeChild script

# Кросс-доменный запрос
setXDR = (url) ->
  script = document.createElement("script")
  script.type = "text/javascript"
  script.src = url
  $head = document.querySelectorAll('head')[0]
  $head.insertBefore script, $head.firstChild
  $head.removeChild script

# Загружает переданный путь и выполняет его как javascript-код
# @param {String} url Путь для загрузки
# @param {Function} cb
# @param {object|undefined} cb.err
getScript = (url, cb) ->
  if (/^http(s){0,1}:\/\//.test(url) or /^\/\//.test(url))
    setXDR url
    cb null
  else
    get url, (err, data) =>
      return cb(err) if err
      try
        globalEval data
        cb null
      catch e
        console.error "wrong js " + url
        cb e

scriptElementBusy = false
# Выполняет script вставленный в DOM
# @param {Object} element тэг script
scriptElement = (element) ->
  if scriptElementBusy
    setTimeout (->
      scriptElement element
    ), 1
    return
  scriptElementBusy = true
  if element.src
    getScript element.src, (err) ->
      scriptElementBusy = false
  else
    try
      globalEval element.innerHTML
    catch e
      console.error e, "error in script tag"
    scriptElementBusy = false

cacheCSS = {}
# Вставляет стили на страницу и применяет их.
# @param {String} code Код css для вставки в документ.
setCSS = (code) ->
  return if cacheCSS[code] #Почему-то если это убрать после нескольких перепарсиваний стили у слоя слетают..
  cacheCSS[code] = true
  style = document.createElement("style") #создани style с css
  style.type = "text/css"
  if style.styleSheet
    style.styleSheet.cssText = code
  else
    style.appendChild document.createTextNode(code)
  $head = document.querySelectorAll('head')[0]
  $head.insertBefore style, $head.lastChild #добавили css на страницу

uniqueId = (length=8) ->
  id = ""
  id += Math.random().toString(36).substr(2) while id.length < length
  id.substr 0, length

# Получить у элемента значение css-свойства
_getStyle = (el, cssprop) ->
  if el.currentStyle #IE
    el.currentStyle[cssprop]
  else if window.document.defaultView and window.document.defaultView.getComputedStyle #Firefox
    window.document.defaultView.getComputedStyle(el, "")[cssprop]
  else #try and get inline style
    el.style[cssprop]

# Вставка скриптов и стилей
pasteHTML = (el, html) ->
  if /<(style+)([^>]+)*(?:>)/g.test(html) or /<(script+)([^>]+)*(?:>)/g.test(html)
    window.scriptautoexec = false
    tempid = "scriptautoexec_" + uniqueId() # Одинаковый id нельзя.. если будут вложенные вызовы будет ошибка
    html = "<span id=\"" + tempid + "\" style=\"display:none\">" + "<style>#" + tempid + "{ width:3px }</style>" + "<script type=\"text/javascript\">window.scriptautoexec=true;</script>" + "1</span>" + html
    el.innerHTML = html
    unless window.scriptautoexec
      scripts = el.getElementsByTagName("script")
      i = 1
      script = undefined
      while script = scripts[i]
        scriptElement script
        i++
    bug = document.getElementById(tempid)
    if bug
      b = _getStyle(bug, "width")
      if b isnt "3px"
        _css = el.getElementsByTagName("style")
        i = 0
        css = undefined
        while css = _css[i]
          t = css.cssText #||css.innerHTML; для IE будет Undefined ну и бог с ним у него и так работает а сюда по ошибке поподаем
          setCSS t
          i++
      el.removeChild bug
  else el.innerHTML = html

module.exports = pasteHTML
