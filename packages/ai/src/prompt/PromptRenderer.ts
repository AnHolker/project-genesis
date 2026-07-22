import type { PromptContext } from './PromptContext'

/**
 * PromptRenderer is the sole component responsible for converting a
 * structured PromptContext into a final prompt string.
 *
 * This abstraction enables future renderer implementations:
 * - MarkdownPromptRenderer    — section-based markdown format
 * - XMLPromptRenderer         — structured XML prompt format
 * - JSONPromptRenderer        — JSON-encoded prompt
 * - OpenAIPromptRenderer      — OpenAI-specific format
 * - ClaudePromptRenderer      — Claude-specific format
 *
 * @see DefaultPromptRenderer — the default implementation
 */
export interface PromptRenderer {
  /**
   * Render a PromptContext to its final string representation.
   *
   * @param context — The structured PromptContext to render
   * @returns The rendered prompt string
   */
  render(context: PromptContext): string
}