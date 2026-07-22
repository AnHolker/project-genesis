import type { PromptBuilder } from './PromptBuilder'
import type { PromptModule } from './modules'
import type { PipelineContext } from '../pipeline'
import type { AIRequest } from '../request'
import type { PromptContext } from './PromptContext'
import type { PromptRenderer } from './PromptRenderer'
import type { Observation } from '../agent'
import type { ReflectionResult } from '../reflection'
import { DefaultPromptRenderer } from './DefaultPromptRenderer'
import { formatObservations as doFormat } from './modules/ObservationPromptModule'
import { formatReflectionResults as doFormatReflection } from './modules/ReflectionPromptModule'

export class DefaultPromptBuilder implements PromptBuilder {
  constructor(
    private readonly modules: PromptModule[],
    private readonly renderer: PromptRenderer = new DefaultPromptRenderer(),
  ) {}

  async build(context: PipelineContext): Promise<AIRequest> {
    const promptContext: PromptContext = {}
    const legacySections: string[] = []

    for (const module of this.modules) {
      // Collect structured context if available
      if ('buildContext' in module && typeof module.buildContext === 'function') {
        const ctx = await module.buildContext(context)
        Object.assign(promptContext, ctx)
      } else {
        // Legacy module fallback: use build() for the raw string
        legacySections.push(await module.build(context))
      }
    }

    // Use PromptRenderer for the structured content
    const rendered = this.renderer.render(promptContext)

    // Append legacy module output if any
    if (legacySections.length > 0) {
      const allParts = [rendered, ...legacySections].filter(Boolean)
      return { prompt: allParts.join('\n') }
    }

    return { prompt: rendered }
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