import { describe, it, expect, vi } from 'vitest'
import { DeepSeekPlannerProvider } from '../provider/DeepSeekPlannerProvider'
import type { AIConfiguration } from '../config'

describe('DeepSeekPlannerProvider', () => {
  const validConfig: AIConfiguration = {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    apiKey: 'sk-755a770a730745c798f54c0bbddb88ec',
    baseURL: 'https://api.deepseek.com',
    temperature: 0.2,
    maxTokens: 800,
  }

  it('should throw if apiKey is missing', () => {
    const config = { ...validConfig, apiKey: undefined }
    expect(() => new DeepSeekPlannerProvider(config)).toThrow(
      'DeepSeekPlannerProvider requires an apiKey in AIConfiguration',
    )
  })

  it('should throw if baseURL is missing', () => {
    const config = { ...validConfig, baseURL: undefined }
    expect(() => new DeepSeekPlannerProvider(config)).toThrow(
      'DeepSeekPlannerProvider requires a baseURL in AIConfiguration',
    )
  })

  it('should return empty actions on empty response', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    // Mock the internal client
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '' } }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await provider.complete({ prompt: 'test' })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('Empty response from DeepSeek')
  })

  it('should parse valid JSON response into actions', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              actions: [
                { type: 'CreateEntity', entityType: 'tree', x: 5, y: 3 },
              ],
            }),
          },
        },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await provider.complete({ prompt: '增加一棵树' })
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('CreateEntity')
  })

  it('should return empty actions on invalid JSON', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'not valid json' } }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await provider.complete({ prompt: 'test' })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('Failed to parse DeepSeek response as JSON')
  })

  it('should return empty actions on network error', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockRejectedValue(new Error('Network error'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await provider.complete({ prompt: 'test' })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toContain('DeepSeek API error')
  })

  it('should return empty actions when actions is not an array', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ actions: 'not-array' }) } }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await provider.complete({ prompt: 'test' })
    expect(result.actions).toEqual([])
    expect(result.reasoning).toBe('actions must be an array')
  })
})
