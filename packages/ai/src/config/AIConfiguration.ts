export interface AIConfiguration {
  provider: string
  model: string
  temperature: number
  maxTokens: number
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