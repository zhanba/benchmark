import _ from 'lodash'
import { Event } from './event'
import { AnyFunction, EventType } from './types'

export class EventEmitter {
  private events: { [type: string]: AnyFunction[] } = {}

  public on(type: EventType | EventType[], listener: AnyFunction) {
    const types = _.isArray(type) ? type : [type]
    types.forEach(typeName => {
      this.events[typeName].push(listener)
    })
    return this
  }

  public off(type: EventType | EventType[], listener?: AnyFunction) {
    const types = _.isArray(type) ? type : [type]
    types.forEach(typeName => {
      if (listener) {
        const index = this.events[typeName].indexOf(listener)
        if (index > -1) {
          this.events[typeName].splice(index, 1)
        }
      } else {
        this.events[typeName] = []
      }
    })
  }

  public emit(type: EventType | Event, ...args: Array<unknown>) {
    const event = typeof type === 'string' ? new Event(type) : type
    event.currentTarget = this
    event.target = this
    delete event.result

    args[0] = event

    if (this.events && Object.keys(this.events).includes(event.type)) {
      const listeners = this.events[event.type]
      listeners.slice().forEach(listener => {
        event.result = listener.apply(this, args)
        if (event.result === false) {
          event.cancelled = true
        }
        return !event.aborted
      })
    }
    return event.result
  }

  public listeners(type: EventType) {
    return Object.keys(this.events).includes(type) ? this.events[type] : []
  }
}
