import type { PromptBuilder } from './PromptBuilder'
import type { PromptModule } from './modules'
import type { PipelineContext } from '../pipeline'
import type { AIRequest } from '../request'
import type { Observation } from '../agent'
import { formatObservations as doFormat } from './modules/ObservationPromptModule'

export class DefaultPromptBuilder implements PromptBuilder {
  constructor(private readonly modules: PromptModule[]) {}

  async build(context: PipelineContext): Promise<AIRequest> {
    const fragments = await Promise.all(
      this.modules.map((m) => m.build(context)),
    )
    return {
      prompt: fragments.join('\n'),
    }
  }

  /**
   * Convert structured Observation[] to formatted prompt text.
   *
   * This is the canonical formatting method — the single source of truth
   * for how observations appear in the prompt. AgentLoop calls this
   * method instead of doing its own inline formatting.
   *
   * Delegates to the same formatter used by ObservationPromptModule.
   */
  formatObservations(observations: Observation[]): string {
    return doFormat(observations)
  }
}