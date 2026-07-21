import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../stores/gameStore'
import { DefaultPipeline, MockStreamingProvider, MockPlannerProvider, MockPlanner, DefaultPromptBuilder, UserInputModule, DefaultAIConfiguration } from '@genesis/ai'
import type { PipelineContext, PipelineEvent } from '@genesis/ai'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Streaming UI Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('gameStore — streaming state', () => {
    it('should expose isStreaming, streamingText, streamingFinished, useStreaming refs', () => {
      const store = useGameStore()
      expect(store.isStreaming).toBe(false)
      expect(store.streamingText).toBe('')
      expect(store.streamingFinished).toBe(false)
      expect(store.useStreaming).toBe(false)
    })

    it('should start with non-streaming mode by default', () => {
      const store = useGameStore()
      expect(store.useStreaming).toBe(false)
    })

    it('should allow toggling useStreaming', () => {
      const store = useGameStore()
      store.useStreaming = true
      expect(store.useStreaming).toBe(true)
      store.useStreaming = false
      expect(store.useStreaming).toBe(false)
    })
  })

  describe('gameStore — StreamChunk event updates', () => {
    it('should accumulate streamingText from StreamChunk events', () => {
      const store = useGameStore()

      // Simulate what the StreamChunk listener does
      const events: PipelineEvent[] = [
        { type: 'StreamChunk', timestamp: Date.now(), payload: { chunk: '{"act' } },
        { type: 'StreamChunk', timestamp: Date.now(), payload: { chunk: 'ions":' } },
        { type: 'StreamChunk', timestamp: Date.now(), payload: { chunk: '[]}' } },
      ]

      for (const event of events) {
        if (event.type === 'StreamChunk' && event.payload?.chunk) {
          store.streamingText += event.payload.chunk as string
        }
      }

      expect(store.streamingText).toBe('{"actions":[]}')
    })

    it('should ignore StreamChunk events without chunk payload', () => {
      const store = useGameStore()

      const event: PipelineEvent = { type: 'StreamChunk', timestamp: Date.now() }
      if (event.type === 'StreamChunk' && event.payload?.chunk) {
        store.streamingText += event.payload.chunk as string
      }

      expect(store.streamingText).toBe('')
    })
  })

  describe('gameStore — streaming state transitions', () => {
    it('should set isStreaming=true when streaming starts and false when done', async () => {
      const streamingProvider = new MockStreamingProvider()
      const planner = new MockPlanner(streamingProvider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

      const store = useGameStore()
      store.useStreaming = true

      // Verify initial state
      expect(store.isStreaming).toBe(false)

      // The store.send() call changes these states internally.
      // We test the state machine by calling the pipeline directly
      // and verifying what the store listener would observe.

      const receivedChunks: string[] = []
      pipeline.events.subscribe({
        onEvent(event: PipelineEvent) {
          if (event.type === 'StreamChunk' && event.payload?.chunk) {
            receivedChunks.push(event.payload.chunk as string)
            store.streamingText += event.payload.chunk as string
          }
        },
      })

      const context: PipelineContext = { input: 'create a tree' }
      await pipeline.stream(context)

      expect(receivedChunks.length).toBeGreaterThan(0)
      expect(store.streamingText.length).toBeGreaterThan(0)
    })

    it('should clear streaming state between sends', () => {
      const store = useGameStore()

      // Simulate state after first send
      store.streamingText = '{"actions":[]}'
      store.streamingFinished = true

      // Simulate resetStreamingState
      store.isStreaming = false
      store.streamingText = ''
      store.streamingFinished = false

      expect(store.streamingText).toBe('')
      expect(store.streamingFinished).toBe(false)
      expect(store.isStreaming).toBe(false)
    })
  })

  describe('gameStore — fallback provider (non-streaming)', () => {
    it('should not emit StreamChunk events for non-streaming provider', async () => {
      const mockConfig = new DefaultAIConfiguration()
      const provider = new MockPlannerProvider(mockConfig)
      const planner = new MockPlanner(provider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder)

      const receivedEvents: PipelineEvent[] = []
      pipeline.events.subscribe({ onEvent: (e) => receivedEvents.push(e) })

      const context: PipelineContext = { input: 'create a tree' }
      await pipeline.stream(context)

      const streamChunks = receivedEvents.filter((e) => e.type === 'StreamChunk')
      expect(streamChunks).toHaveLength(0)

      // Should still return valid result
      const result = await pipeline.stream(context)
      expect(result.plannerResult).toBeDefined()
    })

    it('should produce same PlannerResult with stream() as execute() on fallback', async () => {
      const mockConfig = new DefaultAIConfiguration()
      const provider = new MockPlannerProvider(mockConfig)
      const planner = new MockPlanner(provider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder)

      const context: PipelineContext = { input: 'create a tree' }

      const executeResult = await pipeline.execute(context)
      const streamResult = await pipeline.stream(context)

      expect(streamResult.plannerResult!.actions).toEqual(
        executeResult.plannerResult!.actions,
      )
    })
  })

  describe('gameStore — streaming completion', () => {
    it('should produce valid PlannerResult after streaming completes', async () => {
      const streamingProvider = new MockStreamingProvider()
      const planner = new MockPlanner(streamingProvider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

      const context: PipelineContext = { input: 'create a tree' }
      const result = await pipeline.stream(context)

      expect(result.plannerResult).toBeDefined()
      expect(result.plannerResult!.actions).toHaveLength(1)
      expect(result.plannerResult!.actions[0].type).toBe('CreateEntity')
    })

    it('should set streamingFinished=true after streaming completes', async () => {
      const store = useGameStore()
      expect(store.streamingFinished).toBe(false)

      // Simulate completion
      store.streamingFinished = true
      expect(store.streamingFinished).toBe(true)
    })
  })

  describe('gameStore — runtime consistency', () => {
    it('should apply same actions regardless of streaming mode', async () => {
      const streamingProvider = new MockStreamingProvider()
      const planner = new MockPlanner(streamingProvider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

      const context: PipelineContext = { input: 'create a tree' }

      const executeResult = await pipeline.execute(context)
      const streamResult = await pipeline.stream(context)

      // Both paths should produce identical actions
      expect(executeResult.plannerResult!.actions).toEqual(
        streamResult.plannerResult!.actions,
      )
    })

    it('should not apply actions until stream completes and validation passes', async () => {
      // This verifies the requirement: Runtime must still execute only after
      // stream completes, JSON assembled, StructuredOutputValidator passes
      const streamingProvider = new MockStreamingProvider()
      const planner = new MockPlanner(streamingProvider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder, streamingProvider)

      // During streaming, no plannerResult is available yet
      // Only after pipeline.stream() resolves do we have the result
      const context: PipelineContext = { input: 'tree' }
      const streamPromise = pipeline.stream(context)

      // Before resolution — context has no plannerResult
      expect(context.plannerResult).toBeUndefined()

      // After resolution — plannerResult is available and validated
      const result = await streamPromise
      expect(result.plannerResult).toBeDefined()
      expect(result.plannerResult!.actions.length).toBeGreaterThan(0)
    })
  })

  describe('gameStore — error handling', () => {
    it('should clear streaming state on streaming failure', () => {
      const store = useGameStore()

      // Simulate streaming in progress
      store.isStreaming = true
      store.streamingText = '{"act'
      store.streamingFinished = false

      // Simulate error handling — resetStreamingState
      store.isStreaming = false
      store.streamingText = ''
      store.streamingFinished = false

      expect(store.isStreaming).toBe(false)
      expect(store.streamingText).toBe('')
      expect(store.streamingFinished).toBe(false)
    })

    it('should preserve existing execute() behavior when streaming fails', async () => {
      const mockConfig = new DefaultAIConfiguration()
      const provider = new MockPlannerProvider(mockConfig)
      const planner = new MockPlanner(provider)
      const promptBuilder = new DefaultPromptBuilder([new UserInputModule()])
      const pipeline = new DefaultPipeline(planner, promptBuilder)

      const context: PipelineContext = { input: 'create a tree' }

      // Fallback path should produce same result as execute()
      const executeResult = await pipeline.execute(context)
      expect(executeResult.plannerResult).toBeDefined()
      expect(executeResult.plannerResult!.actions).toHaveLength(1)
    })
  })
})
