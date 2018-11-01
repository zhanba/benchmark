import _ from 'lodash'
// tslint:disable-next-line:no-submodule-imports
import uuid from 'uuid/v4'
import { Event } from './event'
import { EventEmitter } from './eventEmitter'
import { AnyFunction, CompareResult, EventName, EventType } from './types'
import { getU, getZ, uTable } from './util'

export interface IBenchmarkOptions {
  async: boolean
  defer: boolean
  delay: boolean
  id: string
  initCount: number
  maxTime: number
  minSamples: number
  minTime: number
  name: string
  onAbort: AnyFunction
  onComplete: AnyFunction
  onCycle: AnyFunction
  onError: AnyFunction
  onReset: AnyFunction
  onStart: AnyFunction
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
   * A generic Array#filter like method
   * @param array - The array to iterate over
   * @param callback - The function/alias called per iteration
   *
   * @returns A new array of values that passed callback filter
   */
  public static filter: <T>(array: T[], callback: (p: T) => boolean) => T[]

  /**
   * Converts a number to a more readable comma-separated string representation
   *
   * @param n - The number to convert
   *
   * @returns The more readable string representation
   */
  public static formatNumber: (n: number) => string

  /**
   * Invokes a method on all items in an array
   *
   * @param benchs - Array of benchmarks to iterate over
   * @param name - The name of the method to invoke OR benchmark options object
   * @param args - Arguments to invoke the method with
   * @returns A new array of values returned from each method invoked
   */
  public static invoke: (benchs: Benchmark[], name: string | IBenchmarkOptions, ...args: Array<unknown>) => Array<unknown>

  /**
   * Creates a string of joined array values or object key-value pairs
   *
   * @param object - The object to operate on
   * @param separator1 - The separator used between key-value pairs
   * @param separator2 - The separator used between keys and values
   * @returns The joined result
   */
  public static join: (object: object | Array<unknown>, separator1?: string, separator2?: string) => string

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
  public run: unknown

  public support: ISupport
  public stats: IStats = {
    moe: 0,
    rme: 0,
    sem: 0,
    deviation: 0,
    mean: 0,
    sample: [],
    variance: 0,
  }

  public times: ITimes = {
    cycle: 0,
    elapsed: 0,
    period: 0,
    timeStamp: 0,
  }

  public options: IBenchmarkOptions
  public id: string
  public delayTime: number = 0

  private name?: string
  private timerId?: ReturnType<typeof setTimeout>
  // private timerId?: number

  /**
   * Used to avoid infinite recursion when methods call each other
   */
  private calledBy: { [name in EventName]?: boolean } = {}

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
        Benchmark.formatNumber(this.hz.toFixed(this.hz < 100 ? 2 : 0)) +
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
  public clone(options: IBenchmarkOptions): Benchmark {
    // TODO
    return this
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

  /**
   * Delay the execution of a function based on the benchmark's `delay` property.
   *
   * @private
   * @param {Object} bench The benchmark instance.
   * @param {Object} fn The function to execute.
   */
  private delay(bench: Benchmark, fn: AnyFunction) {
    bench.timerId = setTimeout(fn, bench.delayTime * 1e3)
  }
}
