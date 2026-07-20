import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Runtime } from '@genesis/runtime'
import type { Pipeline, PipelineContext } from '@genesis/ai'
import { DefaultPipeline, MockPlanner, ProviderFactory, createAIConfiguration, DefaultAIConfiguration, DefaultPromptBuilder, UserInputModule, MemoryPromptModule, SystemPromptModule, WorldStatePromptModule, DefaultMemory } from '@genesis/ai'

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

  const pipeline: Pipeline = new DefaultPipeline(
    new MockPlanner(createProvider()),
    new DefaultPromptBuilder([new SystemPromptModule(), new UserInputModule(), new MemoryPromptModule(), new WorldStatePromptModule()]),
  )

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

  async function send(input: string) {
    const worldState = formatWorldState()
    const context: PipelineContext = { input, memory, worldState }
    const result = await pipeline.execute(context)
    const actions = result.plannerResult!.actions
    if (actions.length === 0) {
      log.value.push(`Unknown: "${input}"`)
      return
    }

    runtime.value.applyActions(actions)
    renderVersion.value++

    const summary = `Applied ${actions.length} action(s)`
    log.value.push(summary)

    const history = ((await memory.get('conversation')) ?? []) as Array<{ input: string; summary: string }>
    history.push({ input, summary })
    await memory.set('conversation', history)
  }

  return { runtime, renderVersion, log, send }
})