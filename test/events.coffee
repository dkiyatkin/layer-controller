assert = require('assert')
LayerController = require('../src/layer-controller')

describe 'events', ->
  it 'parallel callbacks', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.on 'tested', (done) ->
      assert.equal 5, ++a
      done()

    layer.on 'test', (done, testValue) ->
      process.nextTick ->
        assert.equal 4, ++a
        assert.equal 24, testValue
        done()

    layer.on 'test.prop', (done, testValue) ->
      assert.equal 3, ++a
      done()

    layer.on 'test', (done, testValue) ->
      assert.equal 1, ++a
      assert.equal 24, testValue
      done()

    layer.on 'test', (done) ->
      assert.equal 2, ++a
      done()

    layer.test(24).then (layer) ->
      assert.equal 6, ++a
      testDone()

    , (err) ->
      testDone(err)

  it 'stop callbacks', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.on 'tested', (done) ->
      assert.equal 4, ++a
      done()

    layer.on 'test', (done, testValue) ->
      process.nextTick ->
        assert.equal 3, ++a
        assert.equal 42, testValue
        done()

    layer.on 'test', (done, testValue) ->
      assert.equal 1, ++a
      assert.equal 42, testValue
      done()

    layer.on 'test', (done) ->
      assert.equal 2, ++a
      done(false)

    layer.test(42).then (layer) ->
      assert.strictEqual null, layer
      assert.equal 4, ++a
      testDone()

    , (err) ->
      testDone(err)

  it 'error callbacks', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.on 'tested', (done) ->
      assert.equal 4, ++a
      done()

    layer.on 'test', (done, testValue) ->
      process.nextTick ->
        assert.equal 3, ++a
        assert.equal 42, testValue
        done()

    layer.on 'test', (done, testValue) ->
      assert.equal 1, ++a
      assert.equal 42, testValue
      done(new Error(123))

    layer.on 'test', (done) ->
      assert.equal 2, ++a
      done()

    layer.test(42).then (layer) ->
      assert.ok(false)
      testDone()

    , (err) ->
      assert.equal 4, ++a
      assert.equal true, err instanceof Error
      testDone()

  it 'throw callbacks', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.on 'tested', (done) ->
      assert.equal 4, ++a
      done()

    layer.on 'test', (done, testValue) ->
      process.nextTick ->
        assert.equal 2, ++a
        assert.equal 42, testValue
        done()

    layer.on 'test', (done, testValue) ->
      assert.equal 1, ++a
      assert.equal 42, testValue
      throw new Error('throw in event')
      done()

    layer.on 'test', (done) ->
      assert.equal 2, ++a
      done()

    layer.test(42).then (layer) ->
      assert.ok(false)
      testDone()

    , (err) ->
      assert.equal 3, ++a
      assert.strictEqual true, err instanceof Error
      testDone()

  it 'multiple runs', (testDone) ->
    layer = new LayerController()

    layer.test(42).then (_layer) ->
      assert.strictEqual _layer, layer
      assert.equal 1, layer.testCount

    layer.test(42).then (_layer) ->
      assert.strictEqual _layer, layer
      assert.equal 1, layer.testCount

      layer.test(42).then (_layer) ->
        assert.equal 2, layer.testCount
        testDone()

  it 'multiple runs and errors', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.on 'test', (done) ->
      throw 2
      done()

    layer.test(42).then (layer) ->
      assert.ok(false)

    .then null, ->
      assert.equal 1, ++a

    layer.test(42).then (layer) ->
      assert.ok(false)

    .then null, ->
      assert.equal 2, ++a
      testDone()

  it 'multiple runs and stop', (testDone) ->
    layer = new LayerController()
    a = 0

    layer.on 'test', (done) ->
      done(false)

    layer.test(42).then (layer) ->
      assert.strictEqual null, layer

    layer.test(42).then (layer) ->
      assert.strictEqual null, layer
      testDone()
