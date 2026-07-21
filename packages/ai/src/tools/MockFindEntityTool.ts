import type { Tool } from './Tool'

/**
 * MockFindEntityTool simulates finding an entity by ID or name.
 *
 * This tool returns hardcoded mock data and does NOT access Runtime.
 * It is useful for testing without creating a Runtime instance.
 *
 * For real world data, use FindEntityTool instead.
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