import type { RuntimeHost, ActionHandler } from './ActionHandler'
import type { Action, CreateEntityAction } from '@genesis/shared'

export class CreateEntityHandler implements ActionHandler {
  execute(host: RuntimeHost, action: Action): void {
    const a = action as CreateEntityAction
    host.world.entities.push({
      id: host.generateId(),
      type: a.entityType,
      x: a.x,
      y: a.y,
    })
  }
}