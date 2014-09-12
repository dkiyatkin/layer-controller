_ = require('lodash')
Promise = require('bluebird')
superagent = require('superagent')
LayerController = require('../src/layer-controller')
assert = require('assert')

describe 'load', ->
  @timeout(5000)

  it '_load simple tpl', (testDone) ->
    layer = new LayerController()
    layer.download = '127.0.0.1'

    layer._load().then (data) ->
      assert.strictEqual(layer.data, data, 'layer data')
      assert.ok(data.tpl)
      assert.ok(_.isString(data.tpl))
      testDone()

  it '_load object', (testDone) ->
    layer = new LayerController()
    layer.download =
      one: '127.0.0.1'
      two: '127.0.0.1'
      other:
        three: '127.0.0.1'
        other2:
          four: '127.0.0.1'

    layer._load().then (data) ->
      assert.strictEqual(layer.data, data, 'layer data')
      assert.ok(data.one)
      assert.ok(data.two)
      assert.ok(_.isString(data.one))
      assert.ok(_.isString(data.two))
      assert.ok(_.isString(data.other.three))
      assert.ok(_.isString(data.other.other2.four))
      testDone()

  it '_load array of string', (testDone) ->
    layer = new LayerController()
    layer.download = [
      '127.0.0.1'
      '127.0.0.1'
    ]

    layer._load().then (data) ->
      assert.strictEqual(layer.data, data, 'layer data')
      assert.ok(_.isString(data['0']))
      assert.ok(_.isString(data['1']))
      testDone()

  it '_load array of objects and cache', (testDone) ->
    layer = new LayerController()
    layer.request.agent = superagent.agent()
    layer.download = [{
      one: '127.0.0.1'
      two: '127.0.0.1'
    }, {
      three: '127.0.0.1'
      four: '127.0.0.1'
      other:
        five: '127.0.0.1'
    }]

    layer.load().then (_layer) ->
      assert.strictEqual(layer, _layer, 'layer')
      assert.ok(_.isString(layer.data.one))
      assert.ok(_.isString(layer.data.two))
      assert.ok(_.isString(layer.data.three))
      assert.ok(_.isString(layer.data.four))
      assert.ok(_.isString(layer.data.other.five))
      assert.strictEqual(layer.data.other.five, layer.request.cache['127.0.0.1'], 'cache')
      layer2 = new LayerController()
      layer3 = new LayerController(layer)
      layer.request.loading['testpath'] = 'testdata'
      assert.ok(Object.keys(layer2.request.loading).length is 0)
      assert.equal(layer3.request.loading['testpath'], 'testdata')
      assert.ok(Object.keys(layer2.request.cache).length is 0)
      assert.ok(_.isString(layer3.request.cache['127.0.0.1']), 'cache')
      testDone()
