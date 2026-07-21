import { describe, it, expect, vi } from 'vitest'
import { MockStreamingProvider } from '../provider/MockStreamingProvider'
import { OpenAIPlannerProvider } from '../provider/OpenAIPlannerProvider'
import { DeepSeekPlannerProvider } from '../provider/DeepSeekPlannerProvider'
import type { StreamingPlannerProvider } from '../provider/StreamingPlannerProvider'
import type { PlannerProvider } from '../provider'
import type { AIConfiguration } from '../config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Consume an entire AsyncIterable<string> into a single string. */
async function collectStream(
  stream: AsyncIterable<string>,
): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    result += chunk
  }
  return result
}

/** Create a minimal mock async iterable of OpenAI Responses stream events. */
function makeOpenAIStreamMock(
  textChunks: string[],
): AsyncIterable<{ type: string; delta: string }> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<{ type: string; delta: string }> {
      let i = 0
      return {
        next(): Promise<IteratorResult<{ type: string; delta: string }>> {
          if (i < textChunks.length) {
            return Promise.resolve({
              value: {
                type: 'response.output_text.delta',
                delta: textChunks[i++],
              },
              done: false,
            })
          }
          return Promise.resolve({ value: undefined as never, done: true })
        },
      }
    },
  }
}

/** Create a minimal mock async iterable of Chat Completions stream chunks. */
function makeDeepSeekStreamMock(
  textChunks: string[],
): AsyncIterable<{ choices: Array<{ delta: { content?: string | null } }> }> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<{
      choices: Array<{ delta: { content?: string | null } }>
    }> {
      let i = 0
      return {
        next(): Promise<
          IteratorResult<{
            choices: Array<{ delta: { content?: string | null } }>
          }>
        > {
          if (i < textChunks.length) {
            return Promise.resolve({
              value: {
                choices: [{ delta: { content: textChunks[i++] } }],
              },
              done: false,
            })
          }
          return Promise.resolve({ value: undefined as never, done: true })
        },
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockStreamingProvider', () => {
  it('should implement both PlannerProvider and StreamingPlannerProvider', () => {
    const provider = new MockStreamingProvider()
    expect(typeof (provider as PlannerProvider).complete).toBe('function')
    expect(typeof (provider as StreamingPlannerProvider).stream).toBe('function')
  })

  it('should stream the expected JSON character by character', async () => {
    const provider = new MockStreamingProvider()
    const expected =
      '{"actions":[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}'

    const result = await collectStream(provider.stream({ prompt: 'create a tree' }))

    expect(result).toBe(expected)
  })

  it('should stream exactly one character per yield', async () => {
    const provider = new MockStreamingProvider()
    const chunks: string[] = []

    for await (const chunk of provider.stream({ prompt: 'test' })) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
    for (const c of chunks) {
      expect(c.length).toBe(1)
    }
  })

  it('should close the iterator correctly (for-await...of terminates)', async () => {
    const provider = new MockStreamingProvider()
    let count = 0

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.stream({ prompt: 'test' })) {
      count++
    }

    expect(count).toBe(
      '{"actions":[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}'
        .length,
    )
  })

  it('should allow cancellation via break', async () => {
    const provider = new MockStreamingProvider()
    const chunks: string[] = []

    for await (const chunk of provider.stream({ prompt: 'test' })) {
      chunks.push(chunk)
      if (chunks.length >= 3) break
    }

    expect(chunks).toEqual(['{', '"', 'a'])
  })

  it('should complete (not throw) with no prompt', async () => {
    const provider = new MockStreamingProvider()
    const result = await collectStream(provider.stream({ prompt: '' }))
    expect(result).toBe(
      '{"actions":[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}',
    )
  })
})

describe('OpenAIPlannerProvider stream', () => {
  const validConfig: AIConfiguration = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: 'sk-test',
    temperature: 0.2,
    maxTokens: 800,
  }

  it('should stream text chunks from response.output_text.delta events', async () => {
    const provider = new OpenAIPlannerProvider(validConfig)

    // Mock the internal client.responses.create to return a mock stream
    const mockStream = makeOpenAIStreamMock([
      '{"act',
      'ions":',
      '[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}',
    ])
    const mockCreate = vi.fn().mockResolvedValue(mockStream)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.responses = { create: mockCreate }

    const result = await collectStream(
      provider.stream({ prompt: 'create a tree' }),
    )

    expect(result).toBe(
      '{"actions":[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}',
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        stream: true,
      }),
    )
  })

  it('should yield nothing when there are no text delta events', async () => {
    const provider = new OpenAIPlannerProvider(validConfig)

    // Mock stream with no text delta events (e.g., only metadata events)
    const emptyStream: AsyncIterable<{ type: string; delta: string }> = {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<
            IteratorResult<{ type: string; delta: string }>
          > {
            return Promise.resolve({
              value: undefined as never,
              done: true,
            })
          },
        }
      },
    }
    const mockCreate = vi.fn().mockResolvedValue(emptyStream)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.responses = { create: mockCreate }

    const result = await collectStream(
      provider.stream({ prompt: 'test' }),
    )

    expect(result).toBe('')
  })

  it('should close the iterator correctly', async () => {
    const provider = new OpenAIPlannerProvider(validConfig)

    const mockStream = makeOpenAIStreamMock(['hello', ' ', 'world'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.responses = {
      create: vi.fn().mockResolvedValue(mockStream),
    }

    let count = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.stream({ prompt: 'test' })) {
      count++
    }

    expect(count).toBe(3)
  })

  it('should support cancellation via break', async () => {
    const provider = new OpenAIPlannerProvider(validConfig)

    const mockStream = makeOpenAIStreamMock(['a', 'b', 'c', 'd', 'e'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.responses = {
      create: vi.fn().mockResolvedValue(mockStream),
    }

    const chunks: string[] = []
    for await (const chunk of provider.stream({ prompt: 'test' })) {
      chunks.push(chunk)
      if (chunks.length >= 2) break
    }

    expect(chunks).toEqual(['a', 'b'])
  })
})

describe('DeepSeekPlannerProvider stream', () => {
  const validConfig: AIConfiguration = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: 'sk-test',
    baseURL: 'https://api.deepseek.com',
    temperature: 0.2,
    maxTokens: 800,
  }

  it('should stream text chunks from chat completions delta', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)

    const mockStream = makeDeepSeekStreamMock([
      '{"act',
      'ions"',
      ':[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}',
    ])
    const mockCreate = vi.fn().mockResolvedValue(mockStream)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await collectStream(
      provider.stream({ prompt: 'create a tree' }),
    )

    expect(result).toBe(
      '{"actions":[{"type":"CreateEntity","entityType":"tree","x":5,"y":3}]}',
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
        stream: true,
      }),
    )
  })

  it('should yield nothing when all delta content is null/undefined', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)

    const emptyStream: AsyncIterable<{
      choices: Array<{ delta: { content?: string | null } }>
    }> = {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<
            IteratorResult<{
              choices: Array<{ delta: { content?: string | null } }>
            }>
          > {
            return Promise.resolve({
              value: undefined as never,
              done: true,
            })
          },
        }
      },
    }
    const mockCreate = vi.fn().mockResolvedValue(emptyStream)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = { completions: { create: mockCreate } }

    const result = await collectStream(
      provider.stream({ prompt: 'test' }),
    )

    expect(result).toBe('')
  })

  it('should close the iterator correctly', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)

    const mockStream = makeDeepSeekStreamMock(['hello', ' ', 'world'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = {
      completions: { create: vi.fn().mockResolvedValue(mockStream) },
    }

    let count = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of provider.stream({ prompt: 'test' })) {
      count++
    }

    expect(count).toBe(3)
  })

  it('should support cancellation via break', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)

    const mockStream = makeDeepSeekStreamMock(['x', 'y', 'z'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = {
      completions: { create: vi.fn().mockResolvedValue(mockStream) },
    }

    const chunks: string[] = []
    for await (const chunk of provider.stream({ prompt: 'test' })) {
      chunks.push(chunk)
      if (chunks.length >= 1) break
    }

    expect(chunks).toEqual(['x'])
  })

  it('should skip chunks with null delta content', async () => {
    const provider = new DeepSeekPlannerProvider(validConfig)

    // Some chunks may have content: null (e.g., final done chunk)
    const mixedStream: AsyncIterable<{
      choices: Array<{ delta: { content?: string | null } }>
    }> = {
      [Symbol.asyncIterator]() {
        const chunks = [
          { choices: [{ delta: { content: 'hello' } }] },
          { choices: [{ delta: { content: null } }] },
          { choices: [{ delta: { content: ' world' } }] },
        ]
        let i = 0
        return {
          next() {
            if (i < chunks.length) {
              return Promise.resolve({ value: chunks[i++], done: false })
            }
            return Promise.resolve({ value: undefined as never, done: true })
          },
        }
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(provider as any).client.chat = {
      completions: { create: vi.fn().mockResolvedValue(mixedStream) },
    }

    const result = await collectStream(
      provider.stream({ prompt: 'test' }),
    )

    // 'hello' + ' world' = 'hello world' (null chunk skipped)
    expect(result).toBe('hello world')
  })
})

describe('StreamingPlannerProvider type compatibility', () => {
  it('OpenAIPlannerProvider should satisfy both PlannerProvider and StreamingPlannerProvider', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      temperature: 0.2,
      maxTokens: 800,
    }
    const provider = new OpenAIPlannerProvider(config)

    // Can be used as PlannerProvider (synchronous path)
    const plannerProvider: PlannerProvider = provider
    expect(typeof plannerProvider.complete).toBe('function')

    // Can be used as StreamingPlannerProvider (streaming path)
    const streamingProvider: StreamingPlannerProvider = provider
    expect(typeof streamingProvider.stream).toBe('function')
  })

  it('DeepSeekPlannerProvider should satisfy both PlannerProvider and StreamingPlannerProvider', () => {
    const config: AIConfiguration = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test',
      baseURL: 'https://api.deepseek.com',
      temperature: 0.2,
      maxTokens: 800,
    }
    const provider = new DeepSeekPlannerProvider(config)

    const plannerProvider: PlannerProvider = provider
    expect(typeof plannerProvider.complete).toBe('function')

    const streamingProvider: StreamingPlannerProvider = provider
    expect(typeof streamingProvider.stream).toBe('function')
  })
})

describe('StreamingPlannerProvider interface', () => {
  it('should be assignable from a class that implements both interfaces', () => {
    // Verify the interface contract at runtime
    const provider: StreamingPlannerProvider = new MockStreamingProvider()
    expect(typeof provider.complete).toBe('function')
    expect(typeof provider.stream).toBe('function')
  })
})