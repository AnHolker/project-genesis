import OpenAI from 'openai'
import type { PlannerProvider } from './PlannerProvider'
import type { StreamingPlannerProvider } from './StreamingPlannerProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { AIConfiguration } from '../config'
import { StructuredOutputValidator } from '../validation'

export class DeepSeekPlannerProvider implements PlannerProvider, StreamingPlannerProvider {
  private client: OpenAI
  private config: AIConfiguration

  constructor(config: AIConfiguration) {
    if (!config.apiKey) {
      throw new Error('DeepSeekPlannerProvider requires an apiKey in AIConfiguration')
    }
    if (!config.baseURL) {
      throw new Error('DeepSeekPlannerProvider requires a baseURL in AIConfiguration')
    }
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
  }

  async complete(request: AIRequest): Promise<PlannerResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'user', content: request.prompt },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content || content.trim().length === 0) {
        return { actions: [], reasoning: 'Empty response from DeepSeek' }
      }

      return this.parseResponse(content)
    } catch (error) {
      return {
        actions: [],
        reasoning: `DeepSeek API error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async *stream(request: AIRequest): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'user', content: request.prompt },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }

  private parseResponse(content: string): PlannerResult {
    try {
      const parsed = JSON.parse(content)
      return StructuredOutputValidator.validate(parsed)
    } catch {
      return { actions: [], reasoning: 'Failed to parse DeepSeek response as JSON' }
    }
  }
}
