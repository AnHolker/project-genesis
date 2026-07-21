import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Runtime } from '@genesis/runtime'
import type { Pipeline, PipelineContext, PipelineEvent } from '@genesis/ai'
import { DefaultPipeline, MockPlanner, ProviderFactory, createAIConfiguration, DefaultAIConfiguration, DefaultPromptBuilder, UserInputModule, MemoryPromptModule, SystemPromptModule, WorldStatePromptModule, DefaultMemory, PipelineEventEmitter } from '@genesis/ai'

function createProvider() {
  try {
    return ProviderFactory.create(createAIConfiguration(import.meta.env))
  } catch (error) {
    console.warn(`Provider creation failed, falling back to mock: ${error instanceof Error ? error.message : String(error)}`)
    return ProviderFactory.create(new DefaultAIConfiguration())
  }
}

export const useGameStore = defineStore('game', () => {
  const runtime = ref(new Runtime())
  const renderVersion = ref(0)
  const log = ref<string[]>([])
  const memory = new DefaultMemory()

  // --- Streaming UI state ---
  const isStreaming = ref(false)
  const streamingText = ref('')
  const streamingFinished = ref(false)

  // --- Streaming mode toggle ---
  const useStreaming = ref(false)

  const provider = createProvider()
  const pipeline: Pipeline = new DefaultPipeline(
    new MockPlanner(provider),
    new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule(), new MemoryPromptModule(), new WorldStatePromptModule()]),
    provider,
  )

  // --- Stream event listener ---
  const streamListener = {
    onEvent(event: PipelineEvent): void {
      if (event.type === 'StreamChunk' && event.payload?.chunk) {
        streamingText.value += event.payload.chunk as string
      }
    },
  }

  function formatWorldState(): string {
    const entities = runtime.value.world.entities
    if (entities.length === 0) return '(empty)'

    const lines: string[] = []
    for (const entity of entities) {
      const label = entity.type.charAt(0).toUpperCase() + entity.type.slice(1)
      lines.push(label)
      lines.push(`id: ${entity.id}`)
      lines.push(`position: (${entity.x},${entity.y})`)
      lines.push('')
    }
    // Remove trailing empty line
    lines.pop()
    return lines.join('\n')
  }

  function resetStreamingState(): void {
    isStreaming.value = false
    streamingText.value = ''
    streamingFinished.value = false
  }

  function applyResult(context: PipelineContext, input: string): void {
    const actions = context.plannerResult!.actions
    if (actions.length === 0) {
      log.value.push(`Unknown: "${input}"`)
      return
    }

    runtime.value.applyActions(actions)
    renderVersion.value++

    const summary = `Applied ${actions.length} action(s)`
    log.value.push(summary)

    memory.get('conversation').then((raw) => {
      const history = (raw ?? []) as Array<{ input: string; summary: string }>
      history.push({ input, summary })
      return memory.set('conversation', history)
    })
  }

  async function send(input: string) {
    const worldState = formatWorldState()
    const context: PipelineContext = { input, memory, worldState }

    if (useStreaming.value) {
      await sendStreaming(input, context)
    } else {
      const result = await pipeline.execute(context)
      applyResult(result, input)
    }
  }

  async function sendStreaming(input: string, context: PipelineContext): Promise<void> {
    isStreaming.value = true
    streamingText.value = ''
    streamingFinished.value = false

    // Subscribe to StreamChunk events
    const emitter = (pipeline as DefaultPipeline).events as PipelineEventEmitter
    emitter.subscribe(streamListener)

    try {
      const result = await pipeline.stream(context)
      streamingFinished.value = true
      applyResult(result, input)
    } catch (error) {
      // Streaming failed — clear state, show error, preserve execute() behavior
      resetStreamingState()
      log.value.push(`Streaming error: ${error instanceof Error ? error.message : String(error)}`)

      // Fall back to execute()
      const fallbackResult = await pipeline.execute(context)
      applyResult(fallbackResult, input)
    } finally {
      isStreaming.value = false
      emitter.unsubscribe(streamListener)
    }
  }

  return {
    runtime,
    renderVersion,
    log,
    memory,
    send,
    // Streaming state
    isStreaming,
    streamingText,
    streamingFinished,
    useStreaming,
  }
})
