import type { PlannerProvider } from './PlannerProvider'
import type { AIConfiguration } from '../config'
import { MockPlannerProvider } from './MockPlannerProvider'
import { OpenAIPlannerProvider } from './OpenAIPlannerProvider'
import { DeepSeekPlannerProvider } from './DeepSeekPlannerProvider'

export class ProviderFactory {
  static create(config: AIConfiguration): PlannerProvider {
    switch (config.provider) {
      case 'mock':
        return new MockPlannerProvider(config)
      case 'openai':
        return new OpenAIPlannerProvider(config)
      case 'deepseek':
        return new DeepSeekPlannerProvider(config)
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`)
    }
  }
}
