import { Benchmark } from './benchmark'

/**
 * The cloned benchmark instance
 */
export class Deferred {
  /**
   * The deferred benchmark instance
   */
  public benchmark: Benchmark

  /**
   * The number of deferred cycles performed while benchmarking
   */
  public cycles: number = 0

  /**
   * The time taken to complete the deferred benchmark (secs)
   */
  public elapsed: number = 0

  /**
   * A timestamp of when the deferred benchmark started (ms)
   */
  public timeStamp: number = 0

  /**
   * The Deferred constructor
   * @param clone  The cloned benchmark instance
   */
  constructor(clone: Benchmark) {
    this.benchmark = clone
    clock(this)
  }

  public resolve() {}
}
