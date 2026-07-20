export interface Entity {
  id: string
  type: string
  x: number
  y: number
}

export interface World {
  entities: Entity[]
}

export interface CreateEntityAction {
  type: 'CreateEntity'
  entityType: string
  x: number
  y: number
}

export interface MoveEntityAction {
  type: 'MoveEntity'
  id: string
  x: number
  y: number
}

export type Action = CreateEntityAction | MoveEntityAction