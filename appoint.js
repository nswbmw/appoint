'use strict';

function INTERNAL() {}
function isFunction(func) {
  return typeof func === 'function';
}
function isObject(obj) {
  return typeof obj === 'object';
}
function isArray(arr) {
  return Object.prototype.toString.call(arr) === '[object Array]';
}

var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

module.exports = Promise;

function Promise(resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('resolver must be a function');
  }
  this.state = PENDING;
  this.value = void 0;
  this.queue = [];
  if (resolver !== INTERNAL) {
    safelyResolveThen(this, resolver);
  }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  if (!isFunction(onFulfilled) && this.state === FULFILLED ||
    !isFunction(onRejected) && this.state === REJECTED) {
    return this;
  }
  var promise = new this.constructor(INTERNAL);
  if (this.state !== PENDING) {
    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
    unwrap(promise, resolver, this.value);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }
  return promise;
};

Promise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected);
};

function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  this.callFulfilled = function (value) {
    doResolve(this.promise, value);
  };
  this.callRejected = function (error) {
    doReject(this.promise, error);
  };
  if (isFunction(onFulfilled)) {
    this.callFulfilled = function (value) {
      unwrap(this.promise, onFulfilled, value);
    };
  }
  if (isFunction(onRejected)) {
    this.callRejected = function (error) {
      unwrap(this.promise, onRejected, error);
    };
  }
}

function unwrap(promise, func, value) {
  process.nextTick(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (error) {
      return doReject(promise, error);
    }
    if (returnValue === promise) {
      doReject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      doResolve(promise, returnValue);
    }
  });
}

function doResolve(self, value) {
  try {
    var then = getThen(value);
    if (then) {
      safelyResolveThen(self, then);
    } else {
      self.state = FULFILLED;
      self.value = value;
      self.queue.forEach(function (queueItem) {
        queueItem.callFulfilled(value);
      });
    }
    return self;
  } catch (error) {
    return doReject(self, error);
  }
}

function doReject(self, error) {
  self.state = REJECTED;
  self.value = error;
  self.queue.forEach(function (queueItem) {
    queueItem.callRejected(error);
  });
  return self;
}

function getThen(obj) {
  var then = obj && obj.then;
  if (obj && (isObject(obj) || isFunction(obj)) && isFunction(then)) {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}

function safelyResolveThen(self, then) {
  var called = false;
  try {
    then(function (value) {
      if (called) {
        return;
      }
      called = true;
      doResolve(self, value);
    }, function (error) {
      if (called) {
        return;
      }
      called = true;
      doReject(self, error);
    });
  } catch (error) {
    if (called) {
      return;
    }
    called = true;
    doReject(self, error);
  }
}

Promise.resolve = resolve;
function resolve(value) {
  if (value instanceof this) {
    return value;
  }
  return doResolve(new this(INTERNAL), value);
}

Promise.reject = reject;
function reject(reason) {
  var promise = new this(INTERNAL);
  return doReject(promise, reason);
}

Promise.all = all;
function all(iterable) {
  var self = this;
  if (!isArray(iterable)) {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    self.resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        doReject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len && !called) {
        called = true;
        doResolve(promise, values);
      }
    }
  }
}

Promise.race = race;
function race(iterable) {
  var self = this;
  if (!isArray(iterable)) {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    self.resolve(value).then(function (response) {
      if (!called) {
        called = true;
        doResolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        doReject(promise, error);
      }
    });
  }
}
