import type { Tool } from './Tool'

/**
 * MockFindEntityTool simulates finding an entity by ID or name.
 *
 * This is a demonstration tool for the Tool Calling Foundation (WO-S3-005).
 * It returns hardcoded mock data and does NOT access Runtime.
 *
 * In a future work order (Agent Loop), this tool will be replaced with
 * a real implementation that queries RuntimeQuery.
 */
export class MockFindEntityTool implements Tool {
  readonly name = 'find_entity'
  readonly description =
    'Find an entity by ID or name. Returns entity details including type, position (x, y), and ID.'

  async execute(_input: unknown): Promise<unknown> {
    // Return hardcoded mock data for foundation phase
    return {
      id: 'entity-1',
      type: 'tree',
      x: 5,
      y: 3,
    }
  }
}