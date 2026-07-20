export interface AIConfiguration {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  apiKey?: string
  baseURL?: string
}