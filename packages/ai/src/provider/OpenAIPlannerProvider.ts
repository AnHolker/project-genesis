import OpenAI from 'openai'
import type { PlannerProvider } from './PlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { AIConfiguration } from '../config'
import { StructuredOutputValidator } from '../validation'

export class OpenAIPlannerProvider implements PlannerProvider {
  private client: OpenAI
  private config: AIConfiguration

  constructor(config: AIConfiguration) {
    if (!config.apiKey) {
      throw new Error('OpenAIPlannerProvider requires an apiKey in AIConfiguration')
    }
    this.config = config
    this.client = new OpenAI({ apiKey: config.apiKey })
  }

  async complete(request: AIRequest): Promise<PlannerResult> {
    try {
      const response = await this.client.responses.create({
        model: this.config.model,
        input: request.prompt,
        temperature: this.config.temperature,
        max_output_tokens: this.config.maxTokens,
        text: { format: { type: 'json_object' } },
      })

      const content = response.output_text
      if (!content || content.trim().length === 0) {
        return { actions: [], reasoning: 'Empty response from OpenAI' }
      }

      return this.parseResponse(content)
    } catch (error) {
      return {
        actions: [],
        reasoning: `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  private parseResponse(content: string): PlannerResult {
    try {
      const parsed = JSON.parse(content)
      return StructuredOutputValidator.validate(parsed)
    } catch {
      return { actions: [], reasoning: 'Failed to parse OpenAI response as JSON' }
    }
  }
}