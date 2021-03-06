import _ from 'lodash'
import { EventType } from './types'

export class Event {
  /**
   * A flag to indicate if the emitters listener iteration is aborted
   */
  public aborted: boolean = false
  /**
   * A flag to indicate if the default action is cancelled
   */
  public cancelled: boolean = false
  /**
   * The object whose listeners are currently being processed
   */
  public currentTarget?: object
  /**
   * The return value of the last executed listener
   */
  public result: unknown
  /**
   * The object to which the event was originally emitted
   */
  public target?: object
  /**
   * A timestamp of when the event was created (ms)
   */
  public timeStamp: number
  /**
   * The event type
   */
  public type: EventType

  constructor(type: EventType) {
    this.timeStamp = _.now()
    this.type = type
  }
}
