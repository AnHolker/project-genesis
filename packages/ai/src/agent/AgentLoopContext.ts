import type { AIRequest } from '../request'
import type { Planner } from '../planner'
import type { ToolRegistry } from '../tools'

/**
 * AgentLoopContext carries all data into the AgentLoop execution.
 *
 * Contains the request to plan, the planner to use, and optional tool
 * registry for future multi-iteration tool calling. The context is
 * intentionally Runtime-independent — the AgentLoop stays in the AI layer.
 *
 * @property request - The AI request containing the composed prompt
 * @property planner - The Planner instance to use for each iteration
 * @property toolRegistry - Optional tool registry for future tool execution
 * @property maxIterations - Maximum number of loop iterations (default: 5)
 * @property metadata - Optional extensible metadata
 */
export interface AgentLoopContext {
  /** The AI request containing the composed prompt */
  request: AIRequest

  /** The Planner instance to use for each iteration */
  planner: Planner

  /** Optional tool registry for future tool execution */
  toolRegistry?: ToolRegistry

  /** Maximum number of loop iterations (default: 5, currently not exceeded) */
  maxIterations: number

  /** Optional extensible metadata */
  metadata?: Record<string, unknown>
}