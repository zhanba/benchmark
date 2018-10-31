import { AnyFunction, CompareResult } from './types'

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
  onAbort: () => void
  onComplete: () => void
  onCycle: () => void
  onError: () => void
  onReset: () => void
  onStart: () => void
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

export class Benchmark {
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
  public static invoke: (
    benchs: Benchmark[],
    name: string | IBenchmarkOptions,
    ...args: Array<unknown>
  ) => Array<unknown>

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
  public aborted: boolean

  /**
   * The compiled test function
   */
  public compiled: AnyFunction

  /**
   * The number of times a test was executed
   */
  public count: number

  /**
   * The number of cycles performed while benchmarking
   */
  public cycles: number

  /**
   * The error object if the test failed
   */
  public error: object

  /**
   * The test to benchmark
   */
  public fn: AnyFunction

  /**
   * The number of executions per second
   */
  public hz: number

  /**
   * A flag to indicate if the benchmark is running
   */
  public running: number

  /**
   * Compiled into the test and executed immediately before the test loop
   */
  public setup: AnyFunction

  /**
   * Compiled into the test and executed immediately after the test loop
   */
  public teardown: AnyFunction

  /**
   * Aborts the benchmark without recording times
   * @returns The benchmark instance
   */
  public abort: () => Benchmark

  /**
   * Creates a new benchmark using the same test and options
   * @param options - Options object to overwrite cloned options
   * @returns  The new benchmark instance
   */
  public clone: (options: IBenchmarkOptions) => Benchmark

  /**
   * Determines if a benchmark is faster than another
   * @param other - The benchmark to compare
   * @returns Returns -1 if slower, 1 if faster, and 0 if indeterminate
   */
  public compare: (other: Benchmark) => CompareResult

  public emit: unknown
  public listeners: unknown
  public off: unknown
  public on: unknown
  public reset: unknown
  public run: unknown
  public toString: unknown

  public support: ISupport
  public stats: IStats
}
