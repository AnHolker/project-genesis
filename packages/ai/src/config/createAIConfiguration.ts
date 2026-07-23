import type { AIConfiguration } from './AIConfiguration'

/**
 * Create an AIConfiguration from a key-value environment map.
 *
 * Supported keys:
 *   VITE_AI_PROVIDER        — "mock" | "openai" | "deepseek"  (default: "mock")
 *   VITE_AI_MODEL           — model identifier                  (default: varies by provider)
 *   VITE_AI_API_KEY         — API key                           (required for openai, deepseek)
 *   VITE_AI_BASE_URL        — custom API endpoint               (required for deepseek)
 *   VITE_AI_TEMPERATURE     — response randomness 0.0–2.0       (default: 0.2)
 *   VITE_AI_MAX_TOKENS      — max output tokens                 (default: 800)
 *   VITE_AI_STREAMING       — enable streaming ("true"/"false") (default: undefined)
 *   VITE_AI_TOOL_CALLING    — enable tool calling ("true"/"false") (default: undefined)
 *   VITE_AI_ALLOW_BROWSER   — allow browser API key usage       (default: false)
 *                            MUST only be enabled in development
 *
 * @param env — Environment variable map (e.g. import.meta.env)
 */
export function createAIConfiguration(
  env: Record<string, string | undefined> = {},
): AIConfiguration {
  const provider = env.VITE_AI_PROVIDER || 'mock'
  const apiKey = env.VITE_AI_API_KEY || undefined
  const baseURL = env.VITE_AI_BASE_URL || undefined
  const temperature = env.VITE_AI_TEMPERATURE ? Number(env.VITE_AI_TEMPERATURE) : 0.2
  const maxTokens = env.VITE_AI_MAX_TOKENS ? Number(env.VITE_AI_MAX_TOKENS) : 800
  const allowBrowser = env.VITE_AI_ALLOW_BROWSER === 'true'
  const streaming = env.VITE_AI_STREAMING === 'true' || undefined
  const toolCalling = env.VITE_AI_TOOL_CALLING === 'true' || undefined

  let model = env.VITE_AI_MODEL || ''
  if (!model) {
    switch (provider) {
      case 'mock':
        model = 'mock'
        break
      case 'openai':
        model = 'gpt-4o-mini'
        break
      case 'deepseek':
        model = 'deepseek-chat'
        break
      default:
        model = 'mock'
    }
  }

  const config: AIConfiguration = {
    provider,
    model,
    temperature,
    maxTokens,
    allowBrowser,
  }

  if (streaming !== undefined) config.streaming = streaming
  if (toolCalling !== undefined) config.toolCalling = toolCalling
  if (apiKey) config.apiKey = apiKey
  if (baseURL) config.baseURL = baseURL

  return config
}