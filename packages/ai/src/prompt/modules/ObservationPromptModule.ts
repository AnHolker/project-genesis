import type { PromptModule } from './PromptModule'
import type { PipelineContext } from '../../pipeline'
import type { PromptContext } from '../PromptContext'
import type { Observation } from '../../agent'

/**
 * ObservationPromptModule converts structured Observation[] to prompt text.
 *
 * This module reads observations from PipelineContext.metadata.observations
 * and formats them into a "## Previous Observations" section.
 *
 * It is the SINGLE source of truth for how observations appear in the prompt.
 * AgentLoop no longer formats observations — it only maintains the array
 * and passes it through metadata.
 */
export class ObservationPromptModule implements PromptModule {
  async build(context: PipelineContext): Promise<string> {
    const rawObservations = context.metadata?.observations
    if (!rawObservations || !Array.isArray(rawObservations) || rawObservations.length === 0) {
      return ''
    }

    return formatObservations(rawObservations as unknown as Observation[])
  }

  async buildContext(context: PipelineContext): Promise<Partial<PromptContext>> {
    const text = await this.build(context)
    return { observations: text || undefined }
  }
}

/**
 * Convert structured Observation[] to formatted prompt text.
 *
 * This is the canonical formatting function — used by both ObservationPromptModule
 * (for the initial prompt) and by DefaultAgentLoop (for subsequent iterations).
 */
/**
 * Convert structured Observation[] to formatted prompt text (rich format).
 *
 * This is the canonical formatting function used by ObservationPromptModule
 * for the initial prompt. Produces a structured, human-readable representation
 * suitable for inclusion in the full prompt.
 *
 * Example output:
 * ```
 * ## Previous Observations
 *
 * Iteration 1
 *
 * Tool:
 * find_entity
 *
 * Input:
 * {"id":"e1"}
 *
 * Output:
 * {"found":true}
 *
 * Success:
 * true
 * ```
 */
export function formatObservations(observations: Observation[]): string {
  if (observations.length === 0) return ''

  const lines: string[] = ['## Previous Observations']

  for (const obs of observations) {
    lines.push('')
    lines.push(`Iteration ${obs.iteration}`)
    lines.push('')
    lines.push(`Tool:\n${obs.toolName}`)
    lines.push('')
    lines.push(`Input:\n${JSON.stringify(obs.toolInput, null, 2)}`)
    lines.push('')
    lines.push(`Output:\n${JSON.stringify(obs.toolOutput, null, 2)}`)

    if (obs.success !== undefined) {
      lines.push('')
      lines.push(`Success:\n${obs.success}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format observations as inline text (compact format).
 *
 * Used by DefaultAgentLoop to append new observations between iterations.
 * Produces a compact, single-line-per-observation format that is backward
 * compatible with the previous AgentLoop inline formatting.
 *
 * Example:
 * ```
 * Observation:
 * Tool find_entity returned: {"found":true}
 * ```
 */
export function formatObservationsInline(observations: Observation[]): string {
  if (observations.length === 0) return ''

  const lines: string[] = ['Observation:']
  for (const obs of observations) {
    const output = typeof obs.toolOutput === 'string'
      ? obs.toolOutput
      : JSON.stringify(obs.toolOutput)
    lines.push(`Tool ${obs.toolName} returned: ${output}`)
  }

  return lines.join('\n')
}