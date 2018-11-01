import _ from 'lodash'
import { Benchmark, IBenchmarkOptions } from './benchmark'
import { EventEmitter } from './eventEmitter'
import { AnyFunction } from './types'

interface ISuiteOptions {
  name: string
  onStart: () => void
  onCycle: () => void
  onAbort: () => void
  onError: () => void
  onReset: () => void
  onComplete: () => void
}

export class Suite extends EventEmitter {
  /**
   * A flag to indicate if the suite is aborted
   */
  public aborted: boolean = false

  /**
   * The number of benchmarks in the suite
   */
  public length: number = 0

  /**
   * A flag to indicate if the suite is running
   */
  public running: boolean = false

  /**
   * The default options copied by suite instances
   */
  public options: ISuiteOptions = {
    /**
     * The name of the suite
     */
    name: '',
  }

  constructor(name: string, options: ISuiteOptions)
  constructor(options: ISuiteOptions)
  constructor(name: any, options?: ISuiteOptions) {
    super()
    if (_.isPlainObject(name)) {
      this.options = name
    } else {
      this.options = options!
      this.name = name
      // TODO
    }
  }

  /**
   * Aborts all benchmarks in the suite
   * @returns The suite instance
   */
  public abort(): Suite

  /**
   * Adds a test to the benchmark suite
   * @param name A name to identify the benchmark
   * @param fn The test to benchmark
   * @param options Options object
   * @returns The benchmark instance
   */
  public add(name: string, fn: AnyFunction, options?: IBenchmarkOptions): Benchmark

  /**
   * Creates a new suite with cloned benchmarks
   * @param options Options object to overwrite cloned options
   */
  public clone(options: ISuiteOptions): Suite

  /**
   * An Array#filter like method
   * @param callback The function/alias called per iteration
   * @returns A new suite of benchmarks that passed callback filter
   */
  public filter(callback: AnyFunction): Suite

  /**
   * Resets all benchmarks in the suite
   * @returns The suite instance
   */
  public reset(): Suite

  /**
   * Runs the suite
   * @param options Options object
   * @returns The suite instance
   */
  public run(options?: ISuiteOptions): Suite
}
