var cacheCSS, createRequestObject, get, getScript, globalEval, pasteHTML, scriptElement, scriptElementBusy, setCSS, setXDR, uniqueId, _getStyle;

createRequestObject = function() {
  if (typeof XMLHttpRequest === "undefined" || XMLHttpRequest === null) {
    return function() {
      try {
        return new ActiveXObject("Msxml2.XMLHTTP.6.0");
      } catch (_error) {}
      try {
        return new ActiveXObject("Msxml2.XMLHTTP.3.0");
      } catch (_error) {}
      try {
        return new ActiveXObject("Msxml2.XMLHTTP");
      } catch (_error) {}
      try {
        return new ActiveXObject("Microsoft.XMLHTTP");
      } catch (_error) {}
      throw new Error("This browser does not support XMLHttpRequest.");
    };
  } else {
    return new XMLHttpRequest();
  }
};

get = function(url, cb) {
  var req;
  req = new createRequestObject();
  url = encodeURI(url);
  req.open("GET", url, true);
  req.setRequestHeader('If-Modified-Since', 'Sat, 1 Jan 2005 00:00:00 GMT');
  req.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  req.onreadystatechange = function() {
    var err;
    if (req.readyState === 4) {
      if (req.status === 200) {
        if (cb != null) {
          return cb(null, req.responseText);
        }
      } else {
        err = Error(req.statusText);
        if (cb != null) {
          return cb(err);
        }
      }
    }
  };
  return req.send(null);
};

globalEval = function(data) {
  var $head, script;
  script = document.createElement("script");
  script.type = "text/javascript";
  script.text = data;
  $head = document.querySelectorAll('head')[0];
  $head.insertBefore(script, $head.firstChild);
  return $head.removeChild(script);
};

setXDR = function(url) {
  var $head, script;
  script = document.createElement("script");
  script.type = "text/javascript";
  script.src = url;
  $head = document.querySelectorAll('head')[0];
  $head.insertBefore(script, $head.firstChild);
  return $head.removeChild(script);
};

getScript = function(url, cb) {
  if (/^http(s){0,1}:\/\//.test(url) || /^\/\//.test(url)) {
    setXDR(url);
    return cb(null);
  } else {
    return get(url, (function(_this) {
      return function(err, data) {
        var e;
        if (err) {
          return cb(err);
        }
        try {
          globalEval(data);
          return cb(null);
        } catch (_error) {
          e = _error;
          console.error("wrong js " + url);
          return cb(e);
        }
      };
    })(this));
  }
};

scriptElementBusy = false;

scriptElement = function(element) {
  var e;
  if (scriptElementBusy) {
    setTimeout((function() {
      return scriptElement(element);
    }), 1);
    return;
  }
  scriptElementBusy = true;
  if (element.src) {
    return getScript(element.src, function(err) {
      return scriptElementBusy = false;
    });
  } else {
    try {
      globalEval(element.innerHTML);
    } catch (_error) {
      e = _error;
      console.error(e, "error in script tag");
    }
    return scriptElementBusy = false;
  }
};

cacheCSS = {};

setCSS = function(code) {
  var $head, style;
  if (cacheCSS[code]) {
    return;
  }
  cacheCSS[code] = true;
  style = document.createElement("style");
  style.type = "text/css";
  if (style.styleSheet) {
    style.styleSheet.cssText = code;
  } else {
    style.appendChild(document.createTextNode(code));
  }
  $head = document.querySelectorAll('head')[0];
  return $head.insertBefore(style, $head.lastChild);
};

uniqueId = function(length) {
  var id;
  if (length == null) {
    length = 8;
  }
  id = "";
  while (id.length < length) {
    id += Math.random().toString(36).substr(2);
  }
  return id.substr(0, length);
};

_getStyle = function(el, cssprop) {
  if (el.currentStyle) {
    return el.currentStyle[cssprop];
  } else if (window.document.defaultView && window.document.defaultView.getComputedStyle) {
    return window.document.defaultView.getComputedStyle(el, "")[cssprop];
  } else {
    return el.style[cssprop];
  }
};

pasteHTML = function(el, html) {
  var b, bug, css, i, script, scripts, t, tempid, _css;
  if (/<(style+)([^>]+)*(?:>)/g.test(html) || /<(script+)([^>]+)*(?:>)/g.test(html)) {
    window.scriptautoexec = false;
    tempid = "scriptautoexec_" + uniqueId();
    html = "<span id=\"" + tempid + "\" style=\"display:none\">" + "<style>#" + tempid + "{ width:3px }</style>" + "<script type=\"text/javascript\">window.scriptautoexec=true;</script>" + "1</span>" + html;
    el.innerHTML = html;
    if (!window.scriptautoexec) {
      scripts = el.getElementsByTagName("script");
      i = 1;
      script = void 0;
      while (script = scripts[i]) {
        scriptElement(script);
        i++;
      }
    }
    bug = document.getElementById(tempid);
    if (bug) {
      b = _getStyle(bug, "width");
      if (b !== "3px") {
        _css = el.getElementsByTagName("style");
        i = 0;
        css = void 0;
        while (css = _css[i]) {
          t = css.cssText;
          setCSS(t);
          i++;
        }
      }
      return el.removeChild(bug);
    }
  } else {
    return el.innerHTML = html;
  }
};

module.exports = pasteHTML;
