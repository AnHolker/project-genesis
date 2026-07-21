import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { PlannerProvider } from './PlannerProvider'
import type { Tool } from '../tools'

/**
 * ToolCallingProvider extends PlannerProvider with native tool calling support.
 *
 * Providers that implement this interface can:
 * - Receive Tool instances alongside the AIRequest
 * - Translate Tool definitions to provider-native function/tool schema
 * - Send native tool schemas to the LLM API
 * - Parse tool call responses from the LLM
 * - Execute tool calls and return results to the LLM
 * - Return the final PlannerResult after the tool calling session
 *
 * The lifecycle is managed entirely within the provider — no Planner
 * or Pipeline involvement in the tool calling loop.
 */
export interface ToolCallingProvider extends PlannerProvider {
  /**
   * Complete a planning request with native tool calling.
   *
   * Unlike the base complete() method which may inject tool descriptions
   * as prompt text, this method gives the provider direct access to Tool
   * instances for native API-level function/tool calling.
   *
   * @param request - The AI request containing the prompt
   * @param tools - The Tool instances available for the provider to call
   * @returns A PlannerResult after zero or more tool calling rounds
   */
  completeWithTools(request: AIRequest, tools: Tool[]): Promise<PlannerResult>
}