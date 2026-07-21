import type { Tool } from './Tool'

/**
 * ToolRegistry manages a collection of available tools.
 *
 * The AI layer depends only on this abstraction — no Runtime dependency.
 * Concrete tool implementations are registered at the composition root.
 */
export interface ToolRegistry {
  /** Returns all registered tools */
  getTools(): Tool[]

  /** Find a specific tool by name. Returns undefined if not found. */
  findTool(name: string): Tool | undefined
}

/**
 * DefaultToolRegistry stores tools in a Map for O(1) lookup by name.
 */
export class DefaultToolRegistry implements ToolRegistry {
  private readonly toolMap: Map<string, Tool>

  constructor(tools: Tool[] = []) {
    this.toolMap = new Map()
    for (const tool of tools) {
      this.toolMap.set(tool.name, tool)
    }
  }

  getTools(): Tool[] {
    return Array.from(this.toolMap.values())
  }

  findTool(name: string): Tool | undefined {
    return this.toolMap.get(name)
  }
}