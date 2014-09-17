# Общие методы для модуля

EventEmitter2 = require('eventemitter2').EventEmitter2
moduleKeywords = ['extended', 'included']

class Module extends EventEmitter2
  @extend: (obj) ->
    for key, value of obj when key not in moduleKeywords
      this[key] = value
    obj.extended?.apply(this)
    this

  @include: (obj) ->
    for key, value of obj when key not in moduleKeywords
      this::[key] = value # Assign properties to the prototype
    obj.included?.apply(this)
    this

  @mixOf = (base, mixins...) ->
    class Mixed extends base
    for mixin in mixins by -1 #earlier mixins override later ones
      for name, method of mixin::
        Mixed::[name] = method
    Mixed

Module.EventEmitter2 = EventEmitter2
module.exports = Module
