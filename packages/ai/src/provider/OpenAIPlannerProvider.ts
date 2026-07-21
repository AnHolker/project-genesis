import OpenAI from 'openai'
import type { PlannerProvider } from './PlannerProvider'
import type { StreamingPlannerProvider } from './StreamingPlannerProvider'
import type { ToolCallingProvider } from './ToolCallingProvider'
import type { AIRequest } from '../request'
import type { PlannerResult } from '../planner'
import type { AIConfiguration } from '../config'
import type { Tool } from '../tools'
import { StructuredOutputValidator } from '../validation'
import { getSchemaTools } from './ProviderToolSchemas'

export class OpenAIPlannerProvider implements PlannerProvider, StreamingPlannerProvider, ToolCallingProvider {
  private client: OpenAI
  private config: AIConfiguration

  constructor(config: AIConfiguration) {
    if (!config.apiKey) {
      throw new Error('OpenAIPlannerProvider requires an apiKey in AIConfiguration')
    }
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.allowBrowser ? { dangerouslyAllowBrowser: true } : {}),
    })
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

  /**
   * Complete a planning request with native tool calling via the OpenAI Responses API.
   *
   * Lifecycle:
   * 1. Converts Tool instances to OpenAI function schemas
   * 2. Sends the prompt with tool definitions to the API
   * 3. If the LLM returns function calls, executes them and returns results
   * 4. Sends tool results back to the API for the final response
   * 5. Parses the final response into a PlannerResult
   *
   * Tool execution details are included in PlannerResult.metadata.toolCalls
   * for event emission and observability.
   */
  async completeWithTools(request: AIRequest, tools: Tool[]): Promise<PlannerResult> {
    const schemaTools = getSchemaTools(tools)
    const openAITools = schemaTools.map((s) => ({
      type: 'function' as const,
      name: s.name,
      description: s.description,
      parameters: s.inputSchema as Record<string, unknown>,
      strict: false,
    }))

    // Track tool execution details for event enrichment
    const toolExecutionDetails: Array<{
      name: string
      duration: number
      success: boolean
      error?: string
    }> = []

    const startTime = Date.now()

    try {
      const response = await this.client.responses.create({
        model: this.config.model,
        input: request.prompt,
        ...(openAITools.length > 0 ? { tools: openAITools } : {}),
        temperature: this.config.temperature,
        max_output_tokens: this.config.maxTokens,
        text: { format: { type: 'json_object' } },
      })

      // Check for function calls in the response output
      const functionCalls =
        response.output?.filter((o): o is { type: 'function_call'; name: string; arguments: string; call_id: string } =>
          o.type === 'function_call',
        ) || []

      if (functionCalls.length > 0) {
        const toolResults: Array<Record<string, unknown>> = []

        for (const fc of functionCalls) {
          const toolExecStart = Date.now()
          const tool = tools.find((t) => t.name === fc.name)

          if (!tool) {
            const duration = Date.now() - toolExecStart
            toolExecutionDetails.push({ name: fc.name, duration, success: false, error: 'Tool not found' })
            toolResults.push({
              type: 'function_call_output',
              call_id: fc.call_id,
              output: JSON.stringify({ error: `Unknown tool: ${fc.name}` }),
            })
            continue
          }

          try {
            const args = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments
            const result = await tool.execute(args)
            const duration = Date.now() - toolExecStart
            toolExecutionDetails.push({ name: fc.name, duration, success: true })
            toolResults.push({
              type: 'function_call_output',
              call_id: fc.call_id,
              output: JSON.stringify(result),
            })
          } catch (error) {
            const duration = Date.now() - toolExecStart
            const errorMsg = error instanceof Error ? error.message : String(error)
            toolExecutionDetails.push({ name: fc.name, duration, success: false, error: errorMsg })
            toolResults.push({
              type: 'function_call_output',
              call_id: fc.call_id,
              output: JSON.stringify({ error: errorMsg }),
            })
          }
        }

        // Send tool results back to the API for the final response
        const finalResponse = await this.client.responses.create({
          model: this.config.model,
          previous_response_id: response.id,
          input: toolResults as any,
          temperature: this.config.temperature,
          max_output_tokens: this.config.maxTokens,
          text: { format: { type: 'json_object' } },
        })

        const totalDuration = Date.now() - startTime
        const result = this.parseResponse(finalResponse.output_text)

        return {
          ...result,
          metadata: {
            ...result.metadata,
            toolCalls: toolExecutionDetails,
            totalToolCallDuration: totalDuration,
            nativeToolCalling: true,
          },
        }
      }

      // No tool calls — parse the response directly
      const result = this.parseResponse(response.output_text)
      return {
        ...result,
        metadata: {
          ...result.metadata,
          toolCalls: [],
          nativeToolCalling: true,
        },
      }
    } catch (error) {
      return {
        actions: [],
        reasoning: `OpenAI API error during tool calling: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          toolCalls: toolExecutionDetails,
          nativeToolCalling: true,
        },
      }
    }
  }

  async *stream(request: AIRequest): AsyncIterable<string> {
    const stream = await this.client.responses.create({
      model: this.config.model,
      input: request.prompt,
      temperature: this.config.temperature,
      max_output_tokens: this.config.maxTokens,
      stream: true,
    })

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        yield event.delta
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