_ = require('lodash')
cheerio = require('cheerio')
Promise = require('bluebird')
LayerController = require('../src/layer-controller')
assert = require('assert')

describe 'state', ->
  it 'one layer state', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.state('/1').then (_layer) ->
      assert.equal 1, ++a
      assert.strictEqual(_layer.state.current, '/1', 'first state')

    layer.state('/2').then (_layer) ->
      assert.equal 2, ++a
      assert.strictEqual(_layer, null)
      assert.strictEqual(layer.state.current, '/1')

    layer.state('/3').then (_layer) ->
      assert.equal 3, ++a
      assert.strictEqual(_layer, null)
      assert.strictEqual(layer.state.current, '/1')

    layer.state('/4').then (_layer) ->
      assert.equal 4, ++a
      assert.strictEqual(_layer.state.current, '/4', 'last state')
      testDone()

  it 'one layer state with dom', (testDone) ->
    $ = cheerio.load '<html><body><div id="one_layer"></div></body></html>',
      ignoreWhitespace: false
      xmlMode: false
      lowerCaseTags: true

    layer = new LayerController()
    layer.html = '123'
    layer.selectors = '#one_layer'
    layer.parentNode = $('html')
    a = 0

    layer.state().then (_layer) ->
      assert.equal 1, ++a
      assert.strictEqual($('#one_layer').html(), '123')
      testDone()
