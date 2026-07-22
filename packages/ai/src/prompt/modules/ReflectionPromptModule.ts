import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'
import type { PromptContext } from '../PromptContext'
import type { ReflectionResult } from '../../reflection'

/**
 * ReflectionPromptModule converts structured ReflectionResult[] to prompt text.
 *
 * This module reads reflectionResults from PipelineContext.metadata.reflectionResults
 * and formats them into a "## Previous Reflection" section.
 *
 * It is the SINGLE source of truth for how reflection results appear in the prompt.
 * AgentLoop only records reflection results — it does not format them for the prompt.
 */
export class ReflectionPromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    const rawResults = context.metadata?.reflectionResults
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      return ''
    }

    return formatReflectionResults(rawResults as unknown as ReflectionResult[])
  }

  async buildContext(context: PipelineContext): Promise<Partial<PromptContext>> {
    const text = await this.build(context)
    return { reflections: text || undefined }
  }
}

/**
 * Convert structured ReflectionResult[] to formatted prompt text.
 *
 * This is the canonical formatting function used by ReflectionPromptModule
 * to produce a structured, human-readable representation of reflection
 * results suitable for inclusion in the full prompt.
 *
 * Each iteration's reflection is formatted with iteration number, reasoning,
 * and continue decision.
 *
 * Example output:
 * ```
 * ## Previous Reflection
 *
 * Iteration 1
 *
 * Reasoning:
 * Actions found — task complete
 *
 * Continue:
 * false
 *
 * Iteration 2
 *
 * Reasoning:
 * No actions yet, continuing
 *
 * Continue:
 * true
 * ```
 */
export function formatReflectionResults(results: ReflectionResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = ['## Previous Reflection']

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const iterationNumber = i + 1

    lines.push('')
    lines.push(`Iteration ${iterationNumber}`)
    lines.push('')
    lines.push(`Reasoning:\n${result.reasoning}`)
    lines.push('')
    lines.push(`Continue:\n${String(result.continueLoop)}`)
  }

  return lines.join('\n')
}