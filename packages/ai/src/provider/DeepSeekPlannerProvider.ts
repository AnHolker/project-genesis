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

export class DeepSeekPlannerProvider implements PlannerProvider, StreamingPlannerProvider, ToolCallingProvider {
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
      ...(config.allowBrowser ? { dangerouslyAllowBrowser: true } : {}),
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

  /**
   * Complete a planning request with native tool calling via the DeepSeek Chat Completions API.
   *
   * Lifecycle:
   * 1. Converts Tool instances to DeepSeek (OpenAI-compatible) function schemas
   * 2. Sends the prompt with tool definitions to the API
   * 3. If the LLM returns tool_calls, executes them and returns results
   * 4. Sends tool results back as additional messages
   * 5. Parses the final response into a PlannerResult
   *
   * Tool execution details are included in PlannerResult.metadata.toolCalls
   * for event emission and observability.
   */
  async completeWithTools(request: AIRequest, tools: Tool[]): Promise<PlannerResult> {
    const schemaTools = getSchemaTools(tools)
    const deepseekTools = schemaTools.map((s) => ({
      type: 'function' as const,
      function: {
        name: s.name,
        description: s.description,
        parameters: s.inputSchema as Record<string, unknown>,
      },
    }))

    const toolExecutionDetails: Array<{
      name: string
      duration: number
      success: boolean
      error?: string
    }> = []

    const startTime = Date.now()

    try {
      const messages: Array<Record<string, unknown>> = [
        { role: 'user', content: request.prompt },
      ]

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages as any,
        ...(deepseekTools.length > 0 ? { tools: deepseekTools } : {}),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
      })

      const message = response.choices[0]?.message
      const toolCalls = message?.tool_calls

      if (toolCalls && toolCalls.length > 0) {
        // Add the assistant message with tool calls to the conversation
        messages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        })

        // Execute each tool call
        for (const tc of toolCalls) {
          const toolExecStart = Date.now()
          const tool = tools.find((t) => t.name === tc.function.name)

          if (!tool) {
            const duration = Date.now() - toolExecStart
            toolExecutionDetails.push({ name: tc.function.name, duration, success: false, error: 'Tool not found' })
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: `Unknown tool: ${tc.function.name}` }),
            })
            continue
          }

          try {
            const args = JSON.parse(tc.function.arguments)
            const result = await tool.execute(args)
            const duration = Date.now() - toolExecStart
            toolExecutionDetails.push({ name: tc.function.name, duration, success: true })
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            })
          } catch (error) {
            const duration = Date.now() - toolExecStart
            const errorMsg = error instanceof Error ? error.message : String(error)
            toolExecutionDetails.push({ name: tc.function.name, duration, success: false, error: errorMsg })
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: errorMsg }),
            })
          }
        }

        // Send tool results back for the final response
        const finalResponse = await this.client.chat.completions.create({
          model: this.config.model,
          messages: messages as any,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' },
        })

        const finalContent = finalResponse.choices[0]?.message?.content
        const totalDuration = Date.now() - startTime

        if (!finalContent || finalContent.trim().length === 0) {
          return {
            actions: [],
            reasoning: 'Empty response from DeepSeek after tool calling',
            metadata: {
              toolCalls: toolExecutionDetails,
              totalToolCallDuration: totalDuration,
              nativeToolCalling: true,
            },
          }
        }

        const result = this.parseResponse(finalContent)
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
      const result = this.parseResponse(message?.content || '')
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
        reasoning: `DeepSeek API error during tool calling: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          toolCalls: toolExecutionDetails,
          nativeToolCalling: true,
        },
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