import { Event } from './event'

export type AnyFunction = () => any

export type CompareResult = 1 | -1 | 0

export type EventType = string

export type EventName = 'abort' | 'complete' | 'cycle' | 'error' | 'reset'
