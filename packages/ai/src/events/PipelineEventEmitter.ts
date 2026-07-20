import type { PipelineEvent } from './PipelineEvent'
import type { PipelineEventListener } from './PipelineEventListener'

export class PipelineEventEmitter {
  private listeners: PipelineEventListener[] = []

  subscribe(listener: PipelineEventListener): void {
    this.listeners.push(listener)
  }

  unsubscribe(listener: PipelineEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  emit(event: PipelineEvent): void {
    for (const listener of this.listeners) {
      listener.onEvent(event)
    }
  }
}