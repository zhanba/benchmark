import _ from 'lodash'
// tslint:disable-next-line:no-submodule-imports
import uuid from 'uuid/v4'
import { Deferred } from './deferred'
import { Event } from './event'
import { EventEmitter } from './eventEmitter'
import { AnyFunction, CompareResult, EventType } from './types'
import { divisors, formatNumber, getMean, getU, getZ, isStringable, uTable } from './util'

export interface IBenchmarkOptions {
  async: boolean
  defer: boolean
  delay: number
  id: string
  initCount: number
  maxTime: number
  minSamples: number
  minTime: number
  name: string
}

const defaultOptions: IBenchmarkOptions = {
  async: false,
  defer: false,
  delay: 0.005,
  id: uuid(),
  initCount: 1,
  maxTime: 5,
  minSamples: 5,
  minTime: 0,
  name: '',
}

/**
 * An object used to flag environments/features
 */
interface ISupport {
  /**
   * Detect if running in a browser environment
   */
  browser: boolean
  /**
   * Detect if function decompilation is support
   */
  decompilation: boolean
  /**
   * Detect if the Timers API exists
   */
  timeout: boolean
}

/**
 * An object of stats including mean, margin or error, and standard deviation
 */
interface IStats {
  /**
   * The sample standard deviation
   */
  deviation: number
  /**
   * The sample arithmetic mean (secs)
   */
  mean: number
  /**
   * The margin of error
   */
  moe: number
  /**
   * The relative margin of error (expressed as a percentage of the mean)
   */
  rme: number
  /**
   * The array of sampled periods
   */
  sample: number[]
  /**
   * The standard error of the mean
   */
  sem: number
  /**
   * The sample variance
   */
  variance: number
}

/**
 * An object of timing data including cycle, elapsed, period, start, and stop
 */
interface ITimes {
  /**
   * The time taken to complete the last cycle (secs)
   */
  cycle: number
  /**
   * The time taken to complete the benchmark (secs)
   */
  elapsed: number
  /**
   * The time taken to execute the test once (secs)
   */
  period: number
  /**
   * A timestamp of when the benchmark started (ms)
   */
  timeStamp: number
}

export class Benchmark extends EventEmitter {
  /**
   * The semantic version number
   */
  public static version: string

  /**
   * Create a new Benchmark function using the given context object
   *
   * @param context - The context object
   */
  public static runInContext: (context: object) => Benchmark

  /**
   * Platform object with properties describing things like browser name, version, and operating system. See platform.js.
   */
  public static platform: unknown

  /**
   * Invokes a method on all items in an array
   *
   * @param benchs - Array of benchmarks to iterate over
   * @param name - The name of the method to invoke OR benchmark options object
   * @param args - Arguments to invoke the method with
   * @returns A new array of values returned from each method invoked
   */
  public static invoke(benchs: Benchmark[], name: string | IBenchmarkOptions, ...args: Array<unknown>): Array<unknown> {
    function execute() {}
  }

  /**
   * Creates a string of joined array values or object key-value pairs
   *
   * @param object - The object to operate on
   * @param separator1 - The separator used between key-value pairs
   * @param separator2 - The separator used between keys and values
   * @returns The joined result
   */
  public static join(object: object | Array<unknown>, separator1: string = ',', separator2: string = ': '): string {
    const result: string[] = []

    if (_.isArray(object)) {
      object.forEach(val => result.push(String(val)))
    } else {
      Object.entries(object).forEach(entry => result.push(entry[0] + separator2 + entry[1]))
    }

    return result.join(separator1)
  }

  /**
   * A generic Array#filter like method
   * @param array - The array to iterate over
   * @param callback - The function/alias called per iteration
   * @returns A new array of values that passed callback filter
   */
  public static filter(array: Benchmark[], callback: ((p: Benchmark) => boolean) | 'successful' | 'fastest' | 'slowest'): Benchmark[] {
    let cb
    if (callback === 'successful') {
      // Callback to exclude those that are errored, unrun, or have hz of Infinity.
      cb = (bench: Benchmark) => {
        return bench.cycles && _.isFinite(bench.hz) && !bench.error
      }
    } else if (callback === 'fastest' || callback === 'slowest') {
      // Get successful, sort by period + margin of error, and filter fastest/slowest.
      const result = Benchmark.filter(array, 'successful').sort((a, b) => {
        const statA = a.stats
        const statB = b.stats
        return (statA.mean + statA.moe > statB.mean + statB.moe ? 1 : -1) * (callback === 'fastest' ? 1 : -1)
      })

      return _.filter(result, bench => {
        return result[0].compare(bench) === 0
      })
    }
    return _.filter(array, callback)
  }

  private static defaultOptions: IBenchmarkOptions = defaultOptions

  /**
   * A flag to indicate if the benchmark is aborted
   */
  public aborted: boolean = false

  /**
   * The compiled test function
   */
  public compiled?: AnyFunction

  /**
   * The number of times a test was executed
   */
  public count: number = 0

  public initCount = 0

  /**
   * The number of cycles performed while benchmarking
   */
  public cycles: number = 0

  /**
   * The error object if the test failed
   */
  public error?: object

  /**
   * The test to benchmark
   */
  public fn?: AnyFunction

  /**
   * The number of executions per second
   */
  public hz: number = 0

  /**
   * A flag to indicate if the benchmark is running
   */
  public running: boolean = false

  /**
   * Compiled into the test and executed immediately before the test loop
   */
  public setup: AnyFunction = _.noop

  /**
   * Compiled into the test and executed immediately after the test loop
   */
  public teardown: AnyFunction = _.noop

  public minTime: number

  public support: ISupport
  public stats: IStats = { moe: 0, rme: 0, sem: 0, deviation: 0, mean: 0, sample: [], variance: 0 }

  public times: ITimes = { cycle: 0, elapsed: 0, period: 0, timeStamp: 0 }
  public id: string
  public delayTime: number = 0
  public options: IBenchmarkOptions

  protected timer = { ns: Date, start: null, stop: null }

  /**
   * Used to avoid infinite recursion when methods call each other
   */
  protected calledBy: { [name in EventType]?: boolean } = {}

  private name?: string
  private timerId?: ReturnType<typeof setTimeout>
  private original: Benchmark

  constructor(name: string, fn: AnyFunction, options: IBenchmarkOptions)
  constructor(fn: AnyFunction, options: IBenchmarkOptions)
  constructor(options: IBenchmarkOptions)

  constructor(name: any, fn?: any, options?: any) {
    super()
    if (_.isPlainObject(name)) {
      // 1 argument (options).
      this.options = name
    } else if (_.isFunction(name)) {
      // 2 arguments (fn, options).
      this.options = fn
      this.fn = name
    } else if (_.isPlainObject(fn)) {
      // 2 arguments (name, options).
      this.options = fn
      this.name = name
    } else {
      // 3 arguments (name, fn [, options]).
      this.name = name
      this.fn = fn
      this.options = options
    }

    this.id = uuid()
  }

  public run(options?: IBenchmarkOptions): Benchmark {
    // 新选项覆盖
    this.options = { ...this.options, ...options }

    const event = new Event('start')

    // Set `running` to `false` so `reset()` won't call `abort()`.
    this.running = false
    this.reset()
    this.running = true

    this.count = this.initCount
    this.times.timeStamp = _.now()
    this.emit(event)

    if (event.cancelled) {
      return this
    }

    // For clones created within `compute()`.
    if (this.original) {
      if (this.defer) {
        new Deferred(this)
      } else {
        this.cycle(this, options)
      }
    } else {
      this.compute(this, options)
    }
    return this
  }

  public toString(): string {
    const size = this.stats.sample.length
    const pm = '\xb1'
    let result = this.name || (_.isString(this.id) ? this.id : '<Test #' + this.id + '>')

    if (this.error) {
      let errorStr
      if (!_.isObject(this.error)) {
        errorStr = String(this.error)
      } else if (!_.isError(Error)) {
        errorStr = Benchmark.join(this.error)
      } else {
        // Error#name and Error#message properties are non-enumerable.
        errorStr = Benchmark.join(_.assign({ name: this.error.name, message: this.error.message }, error))
      }
      result += ': ' + errorStr
    } else {
      result +=
        ' x ' +
        formatNumber(this.hz.toFixed(this.hz < 100 ? 2 : 0)) +
        ' ops/sec ' +
        pm +
        this.stats.rme.toFixed(2) +
        '% (' +
        size +
        ' run' +
        (size === 1 ? '' : 's') +
        ' sampled)'
    }
    return result
  }

  public reset(): Benchmark {
    if (this.running && !this.calledBy.abort) {
      this.calledBy.reset = true
      this.abort()
      delete this.calledBy.reset
      return this
    }

    // TODO
    return this
  }

  /**
   * Determines if a benchmark is faster than another
   * @param other - The benchmark to compare
   * @returns Returns -1 if slower, 1 if faster, and 0 if indeterminate
   */
  public compare(other: Benchmark): CompareResult {
    if (this === other) {
      return 0
    }

    let zStat: number
    const { max, min, abs } = Math
    const sample1 = this.stats.sample
    const sample2 = other.stats.sample
    const size1 = sample1.length
    const size2 = sample2.length
    const maxSize = max(size1, size2)
    const minSize = min(size1, size2)
    const u1 = getU(sample1, sample2)
    const u2 = getU(sample2, sample1)
    const u = min(u1, u2)

    if (size1 + size2 > 30) {
      zStat = getZ(u, size1, size2)
      return abs(zStat) > 1.96 ? (u === u1 ? 1 : -1) : 0
    }

    const critical = maxSize < 5 || minSize < 3 ? 0 : uTable[maxSize][minSize - 3]
    return u <= critical ? (u === u1 ? 1 : -1) : 0
  }

  /**
   * Creates a new benchmark using the same test and options
   * @param options - Options object to overwrite cloned options
   * @returns  The new benchmark instance
   */
  public clone(options?: IBenchmarkOptions): Benchmark {
    return new Benchmark({ ...this.options, ...options })
  }

  /**
   * Aborts the benchmark without recording times
   * @returns The benchmark instance
   */
  public abort(): Benchmark {
    if (this.running) {
      const event = new Event('abort')
      this.emit(event)
      if (!event.cancelled || this.calledBy.reset) {
        // Avoid infinite recursion.
        this.calledBy.abort = true
        this.reset()
        delete this.calledBy.abort

        if (this.support.timeout && this.timerId) {
          clearTimeout(this.timerId)
          delete this.timerId
        }
        if (!this.calledBy.reset) {
          this.aborted = true
          this.running = false
        }
      }
    }
    return this
  }

  private enqueue(queue: Benchmark[]) {
    queue.push(
      Object.assign(this.clone(), {
        events: {
          abort: [this.update],
          cycle: [this.update],
          error: [this.update],
          start: [this.update],
        },
        original: this,
      })
    )
  }

  private evalute(event: Event) {
    const clone = event.target
    const done = bench.aborted
  }

  /**
   * Updates the clone/original benchmarks to keep their data in sync.
   */
  private update(event: Event) {
    const { type } = event
    if (this.running) {
      if (type === 'start') {
        this.count = this.initCount
      } else {
        if (type === 'error') {
          this.original.error = this.error
        }
        if (type === 'abort') {
          this.original.abort()
          this.original.emit('cycle')
        }
      }
    } else if (this.aborted) {
      this.events.abort.length = 0
      this.abort()
    }
  }

  private compute() {
    const queue: Benchmark[] = []
    this.enqueue(queue)
    Benchmark.invoke()
  }

  /**
   * Delay the execution of a function based on the benchmark's `delay` property.
   *
   * @param bench The benchmark instance.
   * @param fn The function to execute.
   */
  private delay(bench: Benchmark, fn: AnyFunction) {
    bench.timerId = setTimeout(fn, bench.delayTime * 1e3)
  }

  /**
   * Cycles a benchmark until a run `count` can be established.
   *
   * @param clone The cloned benchmark instance.
   * @param options The options object.
   */
  private cycle(clone: Benchmark | Deferred, options: IBenchmarkOptions) {
    let deferred
    if (clone instanceof Deferred) {
      deferred = clone
      clone = clone.benchmark
    }

    const bench = clone.original

    let cycles
    let clocked
    let minTime
    if (clone.running) {
      cycles = ++clone.cycles
      clocked = deferred ? deferred.elapsed : this.clock(clone)
      minTime = clone.minTime

      if (bench && cycles > bench.cycles) {
        bench.cycles = cycles
      }
      if (clone.error) {
        const event = new Event('error')
        event.message = clone.error
        clone.emit(event)
        if (!event.cancelled) {
          clone.abort()
        }
      }
    }

    if (clone.running) {
      bench.times.cycle = clone.original.times.cycle = clocked
      const period = (bench.times.period = clone.original.times.period = clocked / clone.count)
      bench.hz = clone.hz = 1 / period
      bench.initCount = clone.initCount = clone.count
      clone.running = clocked < minTime

      if (clone.running) {
        const divisor = divisors[clone.cycles]
        if (!clocked && divisor !== undefined) {
          clone.count = Math.floor(4e6 / divisor)
        }
        if (clone.count <= clone.count) {
          clone.count += Math.ceil((minTime - clocked) / period)
        }
        clone.running = clone.count !== Infinity
      }
    }

    // Should we exit early?
    const cycleEvent = new Event('cycle')
    clone.emit(cycleEvent)
    if (cycleEvent.aborted) {
      clone.abort()
    }

    if (clone.running) {
      // TODO
      clone.count = clone.count // ???
      if (deferred) {
        clone.compiled.call(deferred, context, timer)
      } else if (async) {
        this.delay(clone, () => this.cycle(clone, options))
      } else {
        this.cycle(clone)
      }
    } else {
      // Fix TraceMonkey bug associated with clock fallbacks.
      // For more information see http://bugzil.la/509069.
      if (support.browser) {
        runScript(uid + '=1;delete ' + uid)
      }
      // We're done.
      clone.emit('complete')
    }
  }

  /**
   * Clocks the time taken to execute a test per cycle (secs).
   *
   * @param bench The benchmark instance.
   * @returns {number} The time taken.
   */
  private clock() {
    const options = Benchmark.defaultOptions
    const templateData = {}
    const timers = { ns: this.timer.ns, res: Math.max(0.0015, this.getRes('ms')) }
  }

  private _clock(clone: Benchmark | Deferred) {
    let deferred: Deferred | undefined
    if (clone instanceof Deferred) {
      deferred = clone
      clone = deferred.benchmark
    }

    const bench = clone.original
    const stringable = isStringable(bench.fn)
    bench.count = clone.count
    const count = bench.count
    const decompilable = stringable || ((this.support.decompilation && clone.setup !== _.noop) || clone.teardown !== _.noop)
    const id = bench.id
    const name = bench.name || (typeof id === 'number' ? '<Test #' + id + '>' : id)
    const result = 0

    // TODO
    clone.minTime = bench.minTime || (bench.minTime = bench.options.minTime = Benchmark.defaultOptions.minTime)

    let funcBody =
      deferred === undefined
        ? 'var d#=this,${fnArg}=d#,m#=d#.benchmark.original,f#=m#.fn,su#=m#.setup,td#=m#.teardown;' +
          'if(!d#.cycles){' +
          'd#.fn=function(){var ${fnArg}=d#;if(typeof f#=="function"){try{${fn}\n}catch(e#){f#(d#)}}else{${fn}\n}};' +
          'd#.teardown=function(){d#.cycles=0;if(typeof td#=="function"){try{${teardown}\n}catch(e#){td#()}}else{${teardown}\n}};' +
          'if(typeof su#=="function"){try{${setup}\n}catch(e#){su#()}}else{${setup}\n};' +
          't#.start(d#);' +
          '}d#.fn();return{uid:"${uid}"}'
        : 'var r#,s#,m#=this,f#=m#.fn,i#=m#.count,n#=t#.ns;${setup}\n${begin};' +
          'while(i#--){${fn}\n}${end};${teardown}\nreturn{elapsed:r#,uid:"${uid}"}' // When `deferred.cycles` is `0` then... // set `deferred.fn`, // set `deferred.teardown`, // execute the benchmark's `setup`, // start timer, // and then execute `deferred.fn` and return a dummy object.

    // TODO
    let compiled = createCompiled(bench, decompilable, deferred, funcBody)
    const isEmpty = !(templateData.fn || stringable)

    try {
      if (isEmpty) {
        // Firefox may remove dead code from `Function#toString` results.
        // For more information see http://bugzil.la/536085.
        throw new Error('The test "' + name + '" is empty. This may be the result of dead code removal.')
      } else if (!deferred) {
        // Pretest to determine if compiled code exits early, usually by a
        // rogue `return` statement, by checking for a return object with the uid.
        bench.count = 1
        compiled = decompilable && (compiled.call(bench, context, timer) || {}).uid === templateData.uid && compiled
        bench.count = count
      }
    } catch (e) {
      compiled = null
      clone.error = e || new Error(String(e))
      bench.count = count
    }

    // Fallback when a test exits early or errors during pretest.
    if (!compiled && !deferred && !isEmpty) {
      funcBody =
        (stringable || (decompilable && !clone.error)
          ? 'function f#(){${fn}\n}var r#,s#,m#=this,i#=m#.count'
          : 'var r#,s#,m#=this,f#=m#.fn,i#=m#.count') +
        ',n#=t#.ns;${setup}\n${begin};m#.f#=f#;while(i#--){m#.f#()}${end};' +
        'delete m#.f#;${teardown}\nreturn{elapsed:r#}'

      compiled = this.createCompiled(bench, decompilable, deferred, funcBody)

      try {
        // Pretest one more time to check for errors.
        bench.count = 1
        compiled.call(bench, context, timer)
        bench.count = count
        delete clone.error
      } catch (e) {
        bench.count = count
        if (!clone.error) {
          clone.error = e || new Error(String(e))
        }
      }
    }
    // If no errors run the full test loop.
    if (!clone.error) {
      compiled = bench.compiled = clone.compiled = this.createCompiled(bench, decompilable, deferred, funcBody)
      result = compiled.call(deferred || bench, context, timer).elapsed
    }
    return result
  }

  private getRes(unit: 'us' | 'ns' | 'ms') {
    let measured
    let begin
    let count = 30
    let divisor = 1e3
    const ns = this.timer.ns
    const sample = []

    // Get average smallest measurable time.
    while (count--) {
      if (unit === 'us') {
        divisor = 1e6
        if (ns.stop) {
          ns.start()
          while (!(measured = ns.microseconds())) {}
        } else {
          begin = ns()
          while (!(measured = ns() - begin)) {}
        }
      } else if (unit === 'ns') {
        divisor = 1e9
        begin = (begin = ns())[0] + begin[1] / divisor
        while (!(measured = (measured = ns())[0] + measured[1] / divisor - begin)) {}
        divisor = 1
      } else if (ns.now) {
        begin = +ns.now()
        while (!(measured = +ns.now() - begin)) {}
      } else {
        begin = new ns().getTime()
        while (!(measured = new ns().getTime() - begin)) {}
      }
      // Check for broken timers.
      if (measured > 0) {
        sample.push(measured)
      } else {
        sample.push(Infinity)
        break
      }
    }
    // Convert to seconds.
    return getMean(sample) / divisor
  }

  /**
   * Interpolates a given template string.
   */
  private interpolate(string) {
    // Replaces all occurrences of `#` with a unique number and template tokens with content.
    return _.template(string.replace(/\#/g, /\d+/.exec(templateData.uid)))(templateData)
  }

  /**
   * Runs a snippet of JavaScript via script injection.
   *
   * @param {string} code The code to run.
   */
  private runScript(code) {
    const anchor = freeDefine ? define.amd : Benchmark
    const script = document.createElement('script')
    const sibling = document.getElementsByTagName('script')[0]
    const parent = sibling.parentNode
    const prop = uid + 'runScript'
    const prefix = '(' + (freeDefine ? 'define.amd.' : 'Benchmark.') + prop + '||function(){})();'

    // Firefox 2.0.0.2 cannot use script injection as intended because it executes
    // asynchronously, but that's OK because script injection is only used to avoid
    // the previously commented JaegerMonkey bug.
    try {
      // Remove the inserted script *before* running the code to avoid differences
      // in the expected script element count/order of the document.
      script.appendChild(document.createTextNode(prefix + code))
      anchor[prop] = function() {
        destroyElement(script)
      }
    } catch (e) {
      parent = parent.cloneNode(false)
      sibling = null
      script.text = code
    }
    parent.insertBefore(script, sibling)
    delete anchor[prop]
  }

  /**
   * Creates a function from the given arguments string and body.
   *
   * @param {string} args The comma separated function arguments.
   * @param {string} body The function body.
   * @returns {Function} The new function.
   */
  private createFunction() {
    // Lazy define.
    let createFunction = (args, body) => {
      let result
      const anchor = freeDefine ? freeDefine.amd : Benchmark
      const prop = uid + 'createFunction'

      this.runScript((freeDefine ? 'define.amd.' : 'Benchmark.') + prop + '=function(' + args + '){' + body + '}')
      result = anchor[prop]
      delete anchor[prop]
      return result
    }
    // Fix JaegerMonkey bug.
    // For more information see http://bugzil.la/639720.
    createFunction = support.browser && (this.createFunction('', 'return"' + uid + '"') || _.noop)() === uid ? createFunction : Function
    return this.createFunction.apply(null, arguments)
  }

  /**
   * Creates a compiled function from the given function `body`.
   */
  private createCompiled(bench, decompilable, deferred, body) {
    const fn = bench.fn
    const fnArg = deferred ? getFirstArgument(fn) || 'deferred' : ''

    templateData.uid = uid + uidCounter++

    _.assign(templateData, {
      setup: decompilable ? getSource(bench.setup) : interpolate('m#.setup()'),
      fn: decompilable ? getSource(fn) : interpolate('m#.fn(' + fnArg + ')'),
      fnArg,
      teardown: decompilable ? getSource(bench.teardown) : interpolate('m#.teardown()'),
    })

    // Use API of chosen timer.
    if (timer.unit === 'ns') {
      _.assign(templateData, { begin: interpolate('s#=n#()'), end: interpolate('r#=n#(s#);r#=r#[0]+(r#[1]/1e9)') })
    } else if (timer.unit === 'us') {
      if (timer.ns.stop) {
        _.assign(templateData, { begin: interpolate('s#=n#.start()'), end: interpolate('r#=n#.microseconds()/1e6') })
      } else {
        _.assign(templateData, { begin: interpolate('s#=n#()'), end: interpolate('r#=(n#()-s#)/1e6') })
      }
    } else if (timer.ns.now) {
      _.assign(templateData, { begin: interpolate('s#=(+n#.now())'), end: interpolate('r#=((+n#.now())-s#)/1e3') })
    } else {
      _.assign(templateData, { begin: interpolate('s#=new n#().getTime()'), end: interpolate('r#=(new n#().getTime()-s#)/1e3') })
    }
    // Define `timer` methods.
    timer.start = createFunction(interpolate('o#'), interpolate('var n#=this.ns,${begin};o#.elapsed=0;o#.timeStamp=s#'))

    timer.stop = createFunction(interpolate('o#'), interpolate('var n#=this.ns,s#=o#.timeStamp,${end};o#.elapsed=r#'))

    // Create compiled test.
    return createFunction(
      interpolate('window,t#'),
      'var global = window, clearTimeout = global.clearTimeout, setTimeout = global.setTimeout;\n' + interpolate(body)
    )
  }
}
