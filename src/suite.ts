import { Benchmark, IBenchmarkOptions } from './benchmark'
import { AnyFunction } from './types'

interface ISuiteOptions {
  onStart: () => void
  onCycle: () => void
  onAbort: () => void
  onError: () => void
  onReset: () => void
  onComplete: () => void
}

export class Suite {
  /**
   * A flag to indicate if the suite is aborted
   */
  public aborted: boolean

  /**
   * The number of benchmarks in the suite
   */
  public length: number

  /**
   * A flag to indicate if the suite is running
   */
  public running: boolean

  /**
   * The default options copied by suite instances
   */
  public options: {
    /**
     * The name of the suite
     */
    name: string
  }

  constructor(name: string, options: ISuiteOptions) {}

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
   * Executes all registered listeners of the specified event type
   * @param type The event type or object
   * @param args Arguments to invoke the listener with
   * @returns Returns the return value of the last listener executed
   */
  public emit(type: string | object, ...args: Array<unknown>): unknown

  /**
   * An Array#filter like method
   * @param callback The function/alias called per iteration
   * @returns A new suite of benchmarks that passed callback filter
   */
  public filter(callback: AnyFunction): Suite

  /**
   * Returns an array of event listeners for a given type that can be manipulated to add or remove listeners
   * @param type The event type
   * @returns The listeners array
   */
  public listeners(type: string): Array<unknown>

  /**
   * Unregisters a listener for the specified event type(s), or unregisters all listeners for the specified event type(s), or unregisters all listeners for all event types.
   * @param type The event type
   * @param listener The function to unregister
   * @returns The benchmark instance
   */
  public off(type?: string, listener?: () => any): Benchmark
  /**
   * Registers a listener for the specified event type(s)
   * @param type The event type
   * @param listener The function to unregister
   * @returns The benchmark instance
   */
  public on(type?: string, listener?: () => any): Benchmark

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
