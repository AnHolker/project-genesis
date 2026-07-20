import { describe, it, expect } from 'vitest'
import { ProviderFactory } from '../provider/ProviderFactory'
import { MockPlannerProvider } from '../provider/MockPlannerProvider'
import { OpenAIPlannerProvider } from '../provider/OpenAIPlannerProvider'
import { DeepSeekPlannerProvider } from '../provider/DeepSeekPlannerProvider'
import type { AIConfiguration } from '../config'

describe('ProviderFactory', () => {
  it('should create MockPlannerProvider when provider is "mock"', () => {
    const config: AIConfiguration = {
      provider: 'mock',
      model: 'mock',
      temperature: 0,
      maxTokens: 0,
    }
    const provider = ProviderFactory.create(config)
    expect(provider).toBeInstanceOf(MockPlannerProvider)
  })

  it('should create OpenAIPlannerProvider when provider is "openai"', () => {
    const config: AIConfiguration = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
      temperature: 0.2,
      maxTokens: 800,
    }
    const provider = ProviderFactory.create(config)
    expect(provider).toBeInstanceOf(OpenAIPlannerProvider)
  })

  it('should create DeepSeekPlannerProvider when provider is "deepseek"', () => {
    const config: AIConfiguration = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
      temperature: 0.2,
      maxTokens: 800,
    }
    const provider = ProviderFactory.create(config)
    expect(provider).toBeInstanceOf(DeepSeekPlannerProvider)
  })

  it('should throw readable error for unknown provider', () => {
    const config: AIConfiguration = {
      provider: 'unknown-llm',
      model: 'test',
      temperature: 0,
      maxTokens: 0,
    }
    expect(() => ProviderFactory.create(config)).toThrow('Unknown AI provider: unknown-llm')
  })
})
