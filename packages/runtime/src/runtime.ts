import type { World, Action } from '@genesis/shared'
import type { ActionHandler, RuntimeHost } from './handlers/ActionHandler'
import { CreateEntityHandler, MoveEntityHandler } from './handlers'
import { RuntimeQuery } from './query'

export class Runtime implements RuntimeHost {
  readonly world: World
  readonly query: RuntimeQuery
  private nextId = 1
  private registry = new Map<string, ActionHandler>()

  constructor() {
    this.world = { entities: [] }
    this.query = new RuntimeQuery(this.world)
    this.registry.set('CreateEntity', new CreateEntityHandler())
    this.registry.set('MoveEntity', new MoveEntityHandler())
  }

  generateId(): string {
    return `entity-${this.nextId++}`
  }

  applyActions(actions: Action[]): void {
    for (const action of actions) {
      const handler = this.registry.get(action.type)
      if (handler) {
        handler.execute(this, action)
      }
    }
  }
}