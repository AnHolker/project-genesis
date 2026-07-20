import type { AIConfiguration } from './AIConfiguration'

export class DefaultAIConfiguration implements AIConfiguration {
  readonly provider = 'mock'
  readonly model = 'mock'
  readonly temperature = 0
  readonly maxTokens = 0
}