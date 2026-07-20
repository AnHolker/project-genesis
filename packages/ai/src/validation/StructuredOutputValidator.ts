import type { Action } from '@genesis/shared'
import type { PlannerResult } from '../planner'

type ValidationError = string

export class StructuredOutputValidator {
  static validate(input: unknown): PlannerResult {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { actions: [], reasoning: 'Response is not an object' }
    }

    const root = input as Record<string, unknown>
    const rawActions = root.actions

    if (!Array.isArray(rawActions)) {
      return { actions: [], reasoning: 'actions must be an array' }
    }

    const validActions: Action[] = []
    const errors: ValidationError[] = []

    for (let i = 0; i < rawActions.length; i++) {
      const raw = rawActions[i]
      const error = StructuredOutputValidator.validateAction(raw)
      if (error) {
        errors.push(error)
      } else {
        validActions.push(raw as Action)
      }
    }

    if (errors.length === 0) {
      return { actions: validActions }
    }

    return {
      actions: validActions,
      reasoning: `Discarded ${errors.length} invalid action(s): ${errors.join('; ')}`,
    }
  }

  private static validateAction(raw: unknown): ValidationError | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return 'action must be an object'
    }

    const action = raw as Record<string, unknown>
    const type = action.type

    if (typeof type !== 'string') {
      return 'action.type must be a string'
    }

    switch (type) {
      case 'CreateEntity':
        return StructuredOutputValidator.validateCreateEntity(action)
      case 'MoveEntity':
        return StructuredOutputValidator.validateMoveEntity(action)
      default:
        return `unknown type ${type}`
    }
  }

  private static validateCreateEntity(action: Record<string, unknown>): ValidationError | null {
    if (typeof action.entityType !== 'string') {
      return 'CreateEntity.entityType must be a string'
    }
    if (typeof action.x !== 'number') {
      return 'CreateEntity.x must be a number'
    }
    if (typeof action.y !== 'number') {
      return 'CreateEntity.y must be a number'
    }
    return null
  }

  private static validateMoveEntity(action: Record<string, unknown>): ValidationError | null {
    if (typeof action.id !== 'string') {
      return 'MoveEntity.id must be a string'
    }
    if (typeof action.x !== 'number') {
      return 'MoveEntity.x must be a number'
    }
    if (typeof action.y !== 'number') {
      return 'MoveEntity.y must be a number'
    }
    return null
  }
}
