import type { Tool } from '../tools'

/**
 * JSON Schema representation of a tool's input parameters.
 * Used by providers to translate Tool definitions into native
 * function/tool schema for LLM API calls.
 */
export interface ToolInputSchema {
  type: 'object'
  properties: Record<string, { type: string; description?: string }>
  required: string[]
  [key: string]: unknown
}

/**
 * Complete tool schema descriptor including input schema.
 * Providers use this to build native API tool definitions.
 */
export interface ToolSchemaDescriptor {
  name: string
  description: string
  inputSchema: ToolInputSchema
}

/**
 * Known tool schemas mapped by tool name.
 *
 * Each Tool implementation documents its expected input format
 * through its description and execute() parameter contract.
 * This mapping provides explicit JSON Schema definitions for
 * provider-native function/tool calling.
 *
 * When adding a new tool, add its schema here to enable native
 * tool calling support.
 */
const KNOWN_TOOL_SCHEMAS: Record<string, ToolInputSchema> = {
  find_entity: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The unique ID of the entity to find' },
    },
    required: ['id'],
  },
  find_entities: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Optional entity type to filter by (e.g., "tree", "house"). If omitted, returns all entities.' },
    },
    required: [],
  },
  get_world_snapshot: {
    type: 'object',
    properties: {},
    required: [],
  },
}

/**
 * Get the input schema for a given tool.
 *
 * Returns undefined for unknown tools — the caller (provider) can
 * fall back to prompt-based tool descriptions.
 */
export function getToolInputSchema(tool: Tool): ToolInputSchema | undefined {
  return KNOWN_TOOL_SCHEMAS[tool.name]
}

/**
 * Check if a tool has a known input schema for native tool calling.
 */
export function hasToolSchema(tool: Tool): boolean {
  return tool.name in KNOWN_TOOL_SCHEMAS
}

/**
 * Build the set of tools that have known schemas.
 * Tools without schemas should fall back to prompt-based descriptions.
 */
export function getSchemaTools(tools: Tool[]): ToolSchemaDescriptor[] {
  return tools
    .filter((t) => hasToolSchema(t))
    .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: getToolInputSchema(t)!,
    }))
}