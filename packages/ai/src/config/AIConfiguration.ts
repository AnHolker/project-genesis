/**
 * AIConfiguration is the unified configuration model for the AI subsystem.
 *
 * This interface serves as the single source of truth for all AI runtime
 * settings: provider selection, model identification, token limits,
 * streaming behavior, tool calling, and provider-specific credentials.
 *
 * Design principles:
 * - Immutable preferred — implementations should use readonly properties
 * - Deterministic — same configuration always produces same behavior
 * - No side effects — no I/O, no SDK calls, no environment access
 * - Replaceable — new DefaultAIConfiguration() provides sensible defaults
 *
 * All fields are optional except `provider`, enabling gradual adoption:
 * new components can read from AIConfiguration without requiring all fields.
 *
 * Future consumers (planned, not yet implemented):
 * - DefaultPromptBuilder — provider name, model name, charsPerToken
 * - DefaultPromptSelection — dynamic budget threshold from maxOutputTokens
 * - DefaultProviderBudget — derive provider/model for capacity lookup
 * - RetryPlanner — retry policy configuration
 * - Pipeline — streaming and tool calling flags
 *
 * @see DefaultAIConfiguration — the default implementation
 */
export interface AIConfiguration {
  /** Provider identifier (e.g., "mock", "openai", "deepseek", "anthropic") */
  provider: string

  /** Model identifier (e.g., "gpt-4o", "deepseek-chat") */
  model: string

  /** Response randomness (0.0–2.0). Default implementations use 0. */
  temperature: number

  /**
   * Maximum output tokens for generation.
   *
   * @deprecated Use maxOutputTokens instead. Kept for backward compatibility.
   */
  maxTokens: number

  /**
   * Maximum output tokens for generation.
   * Preferred over maxTokens for new code.
   */
  maxOutputTokens?: number

  /** Enable streaming response mode */
  streaming?: boolean

  /** Enable native tool calling support */
  toolCalling?: boolean

  /** API key for the LLM provider */
  apiKey?: string

  /** Custom API endpoint URL */
  baseURL?: string

  /**
   * Allow the OpenAI SDK client to operate in browser environments.
   * Should ONLY be enabled during local development.
   * NEVER enable in production.
   */
  allowBrowser?: boolean
}