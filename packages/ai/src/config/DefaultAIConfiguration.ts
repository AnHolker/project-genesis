import type { AIConfiguration } from './AIConfiguration'

/**
 * DefaultAIConfiguration provides sensible defaults for the AI subsystem.
 *
 * Features:
 * - Immutable (all properties are readonly)
 * - Deterministic (same values on every instantiation)
 * - No side effects (no I/O, no SDK calls, no environment variable access)
 * - No SDK dependency
 *
 * Defaults:
 * - provider: "mock"
 * - model: "mock"
 * - temperature: 0
 * - maxTokens: 0
 * - streaming: false
 * - toolCalling: false
 * - All optional fields (apiKey, baseURL, allowBrowser, maxOutputTokens) are undefined
 */
export class DefaultAIConfiguration implements AIConfiguration {
  readonly provider = 'mock'
  readonly model = 'mock'
  readonly temperature = 0
  readonly maxTokens = 0
  readonly streaming = false
  readonly toolCalling = false
  readonly maxOutputTokens = undefined as number | undefined
  readonly apiKey = undefined as string | undefined
  readonly baseURL = undefined as string | undefined
  readonly allowBrowser = undefined as boolean | undefined
}