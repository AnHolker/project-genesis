import type { AgentLoopContext } from './AgentLoopContext'
import type { AgentLoopResult } from './AgentLoopResult'

/**
 * AgentLoop defines the contract for iterative AI reasoning.
 *
 * The AgentLoop receives a context containing the AI request, planner,
 * and tool registry, then executes planning iterations. Each iteration
 * represents one complete thought → tool → observation cycle.
 *
 * The current implementation (DefaultAgentLoop) executes exactly ONE
 * iteration — it is the foundation for future multi-loop execution.
 *
 * Design principles:
 * - Pipeline is the ONLY application entry point (AgentLoop is optional)
 * - AgentLoop lives INSIDE the AI layer (no Runtime dependency)
 * - The loop controls iteration but does NOT modify Planner or Provider
 */
export interface AgentLoop {
  /**
   * Execute the agent loop with the given context.
   * Returns the loop result containing all steps and the final planner result.
   */
  execute(context: AgentLoopContext): Promise<AgentLoopResult>
}