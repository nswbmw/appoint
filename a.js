function INTERNAL () {}
function isFunction (func) {
  return typeof func === 'function'
}
function isObject (obj) {
  return typeof obj === 'object'
}
function isArray (arr) {
  return Array.isArray(arr)
}

const PENDING = 'pending'
const FULFILLED = 'fullfilled'
const REJECTED = 'rejected'

module.exports = Promise

function Promise (resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('resolver must be a function')
  }
  this.state = PENDING
  this.value = void 0
  this.queue = []
  if (resolver !== INTERNAL) {
    safelyResolveThen(this, resolver)
  }
}

function safelyResolveThen (self, then) {
  var called = false
  try {
    then(function (value) {
      if (called) {
        return
      }
      called = true
      doResolve(self, value)
    }, function (error) {
      if (called) {
        return
      }
      called = true
      doReject(self, error)
    })
  } catch (error) {
    if (called) {
      return
    }
    called = true
    doReject(self, error)
  }
}
