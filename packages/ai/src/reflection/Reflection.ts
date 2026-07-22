import type { ReflectionContext } from './ReflectionContext'
import type { ReflectionResult } from './ReflectionResult'

/**
 * Reflection defines the contract for evaluating the current planning state.
 *
 * The Reflection component inspects the accumulated context (planner result,
 * observations, loop steps, iteration state) and produces a judgment about
 * whether the loop should continue, stop, or adjust.
 *
 * Design principles:
 * - Independent: no dependency on Runtime, Renderer, Provider, or Planner
 * - Observational: reads state, does not mutate
 * - Extensible: future WO can add real LLM-based reflection
 * - Decoupled from AgentLoop: AgentLoop calls Reflection, but Reflection
 *   does not know about AgentLoop
 *
 * Current behavior:
 * - DefaultReflection uses simple rules (actions present → stop, max iterations → stop)
 * - Future implementations may use LLM self-critique or other heuristics
 * - The result currently only informs, does not control AgentLoop behavior
 */
export interface Reflection {
  /**
   * Execute reflection on the current planning state.
   * Returns the reflection result with reasoning and suggested action.
   */
  execute(context: ReflectionContext): Promise<ReflectionResult>
}