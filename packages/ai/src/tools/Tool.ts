/**
 * Tool represents a callable capability that the planner can invoke
 * during planning to gather information or perform actions.
 *
 * Tools are provider-independent abstractions. Neither Tool nor its
 * implementations import Runtime, World, or entity types.
 */
export interface Tool {
  /** Unique name used to reference the tool (e.g., "find_entity") */
  name: string

  /** Human-readable description of what the tool does */
  description: string

  /**
   * Execute the tool with the given input and return a result.
   *
   * Concrete execution remains outside providers.
   * The ToolCallPlanner orchestrates execution.
   */
  execute(input: unknown): Promise<unknown>
}