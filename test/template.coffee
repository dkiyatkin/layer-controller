_ = require('lodash')
mustache = require('mustache')
cheerio = require('cheerio')
Promise = require('bluebird')
LayerController = require('../src/layer-controller')
assert = require('assert')

describe 'template', ->
  it 'default render', (testDone) ->
    layer = new LayerController()
    layer.config.name = 'fred'
    layer.config.tpl1 = '<%= config.name %>'
    assert.strictEqual('fred', layer.render(layer.config.tpl1))
    layer.config.list = { 'people': ['fred', 'barney'] }
    layer.config.tpl2 = '<% _.forEach(config.list.people, function(name) { %><li><%- name %></li><% }); %>'
    assert.strictEqual('<li>fred</li><li>barney</li>', layer.render(layer.config.tpl2))
    testDone()

  it 'extend render', (testDone) ->
    class MyLayer extends LayerController
      render: (tpl = '') ->
        tpl = tpl + ''
        return mustache.render(tpl, this) if tpl.indexOf('{{') >= 0
        tpl

    layer = new MyLayer()
    layer.value = 42
    assert.strictEqual('42', layer.render('{{value}}'))
    testDone()
