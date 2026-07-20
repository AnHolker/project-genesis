import type { RuntimeHost, ActionHandler } from './ActionHandler'
import type { Action, MoveEntityAction } from '@genesis/shared'

export class MoveEntityHandler implements ActionHandler {
  execute(host: RuntimeHost, action: Action): void {
    const a = action as MoveEntityAction
    const entity = host.world.entities.find((e) => e.id === a.id)
    if (entity) {
      entity.x = a.x
      entity.y = a.y
    }
  }
}