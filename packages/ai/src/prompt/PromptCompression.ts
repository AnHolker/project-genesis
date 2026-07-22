import type { PromptContext } from './PromptContext'

/**
 * PromptCompression is a pluggable compression interface for PromptContext.
 *
 * Compression operates on the structured PromptContext BEFORE it reaches
 * the PromptRenderer. Each implementation transforms the context and
 * returns a NEW PromptContext — the original is never modified.
 *
 * This is NOT Token Compression, LLM Summary, or Memory Ranking.
 * This is the abstract foundation that enables future compression strategies.
 *
 * Design principles:
 * - Input/Output is PromptContext (never raw prompt strings)
 * - Returns a NEW PromptContext (immutable — does not mutate input)
 * - No dependency on Planner, Provider, Runtime, or AgentLoop
 * - Composable: can be disabled, replaced, chained
 * - Side-effect free and testable
 *
 * Future implementations:
 * - NoopCompression         — passthrough (current default)
 * - RuleBasedCompression    — remove empty/undefined fields
 * - TokenCompression        — truncate by token count
 * - LLMCompression          — summarize sections via LLM
 * - MemoryRanking           — score/filter memory entries
 *
 * @see DefaultPromptCompression — the default noop implementation
 */
export interface PromptCompression {
  /**
   * Compress a PromptContext and return a new PromptContext.
   *
   * Implementations MUST:
   * - Return a NEW object (do not mutate the input)
   * - Preserve all fields that are not explicitly compressed
   * - Be idempotent (compress(compress(ctx)) === compress(ctx))
   *
   * @param context — The structured PromptContext to compress
   * @returns A new, compressed PromptContext
   */
  compress(context: PromptContext): PromptContext
}