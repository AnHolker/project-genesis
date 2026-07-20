import type { World, Action } from '@genesis/shared'

export interface RuntimeHost {
  readonly world: World
  generateId(): string
}

export interface ActionHandler {
  execute(host: RuntimeHost, action: Action): void
}