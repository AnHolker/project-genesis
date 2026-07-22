import type { PromptBuilder } from './PromptBuilder'
import type { PromptModule } from './modules'
import type { PipelineContext } from '../pipeline'
import type { AIRequest } from '../request'
import type { PromptContext } from './PromptContext'
import type { Observation } from '../agent'
import type { ReflectionResult } from '../reflection'
import { formatObservations as doFormat } from './modules/ObservationPromptModule'
import { formatReflectionResults as doFormatReflection } from './modules/ReflectionPromptModule'

export class DefaultPromptBuilder implements PromptBuilder {
  constructor(private readonly modules: PromptModule[]) {}

  async build(context: PipelineContext): Promise<AIRequest> {
    const promptContext: PromptContext = {}
    const sections: string[] = []

    for (const module of this.modules) {
      // Collect structured context if available
      if ('buildContext' in module && typeof module.buildContext === 'function') {
        const ctx = await module.buildContext(context)
        Object.assign(promptContext, ctx)

        // Serialize the section from the context key
        const key = Object.keys(ctx)[0] as keyof PromptContext
        if (key) {
          sections.push(promptContext[key] ?? '')
        }
      } else {
        // Legacy module fallback: use build() for the raw string
        sections.push(await module.build(context))
      }
    }

    return {
      prompt: sections.join('\n'),
    }
  }

  /**
   * Get the structured PromptContext for the given PipelineContext.
   *
   * This method composes the same data as build() but returns it as a
   * structured PromptContext instead of a serialized string.
   * Useful for consumers that need structured access to prompt sections.
   *
   * Only modules implementing buildContext() contribute structured data.
   * Legacy modules (build() only) are skipped.
   */
  async buildContext(context: PipelineContext): Promise<PromptContext> {
    const promptContext: PromptContext = {}

    for (const module of this.modules) {
      if ('buildContext' in module && typeof module.buildContext === 'function') {
        const ctx = await module.buildContext(context)
        Object.assign(promptContext, ctx)
      }
    }

    return promptContext
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

  /**
   * Convert structured ReflectionResult[] to formatted prompt text.
   *
   * This is the canonical formatting method for how reflection results
   * appear in the prompt. Delegates to the same formatter used by
   * ReflectionPromptModule.
   */
  formatReflectionResults(results: ReflectionResult[]): string {
    return doFormatReflection(results)
  }
}