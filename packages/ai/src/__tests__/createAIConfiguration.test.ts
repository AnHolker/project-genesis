import { describe, it, expect } from 'vitest'
import { createAIConfiguration } from '../config/createAIConfiguration'

describe('createAIConfiguration', () => {
  it('should return mock defaults when no env provided', () => {
    const config = createAIConfiguration()
    expect(config.provider).toBe('mock')
    expect(config.model).toBe('mock')
    expect(config.apiKey).toBeUndefined()
    expect(config.baseURL).toBeUndefined()
    expect(config.temperature).toBe(0.2)
    expect(config.maxTokens).toBe(800)
  })

  it('should create openai config from env', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_API_KEY: 'sk-test',
      VITE_AI_MODEL: 'gpt-4o',
    })
    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o')
    expect(config.apiKey).toBe('sk-test')
  })

  it('should use default model for openai when model not specified', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
      VITE_AI_API_KEY: 'sk-test',
    })
    expect(config.model).toBe('gpt-4o-mini')
  })

  it('should create deepseek config from env', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'deepseek',
      VITE_AI_API_KEY: 'ds-test',
      VITE_AI_BASE_URL: 'https://api.deepseek.com',
    })
    expect(config.provider).toBe('deepseek')
    expect(config.model).toBe('deepseek-chat')
    expect(config.apiKey).toBe('ds-test')
    expect(config.baseURL).toBe('https://api.deepseek.com')
  })

  it('should parse temperature and maxTokens as numbers', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'mock',
      VITE_AI_TEMPERATURE: '0.5',
      VITE_AI_MAX_TOKENS: '1000',
    })
    expect(config.temperature).toBe(0.5)
    expect(config.maxTokens).toBe(1000)
  })

  it('should omit apiKey and baseURL when not in env', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'openai',
    })
    expect(config.apiKey).toBeUndefined()
    expect(config.baseURL).toBeUndefined()
  })

  it('should use custom model when specified', () => {
    const config = createAIConfiguration({
      VITE_AI_PROVIDER: 'deepseek',
      VITE_AI_MODEL: 'deepseek-reasoner',
    })
    expect(config.model).toBe('deepseek-reasoner')
  })
})
