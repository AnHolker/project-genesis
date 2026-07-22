import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'
import type { PromptContext } from '../PromptContext'

export class MemoryPromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    if (!context.memory) return ''

    const history = await context.memory.get('conversation')
    if (!history || !Array.isArray(history)) return ''

    const lines: string[] = ['Previous conversation:']
    for (const entry of history) {
      if (entry.input) lines.push(`User: ${entry.input}`)
      if (entry.summary) lines.push(`Assistant: ${entry.summary}`)
    }

    return lines.length > 1 ? lines.join('\n') : ''
  }

  async buildContext(context: PipelineContext): Promise<Partial<PromptContext>> {
    const text = await this.build(context)
    return { memory: text || undefined }
  }
}