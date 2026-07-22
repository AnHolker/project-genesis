import type { PromptContext } from './PromptContext'
import type { MemoryRankingResult } from './MemoryRankingResult'

/**
 * MemoryRanking is a pluggable ranking interface for PromptContext sections.
 *
 * Ranking determines the priority/importance of each section in a PromptContext
 * WITHOUT modifying the context or removing any content. It is a pure
 * measurement — not a transformer.
 *
 * This is NOT:
 * - Memory Store (ranking does not store or retrieve data)
 * - Vector Database (no embedding or similarity search)
 * - Embedding (no vector representation)
 * - Semantic Search (no query-based retrieval)
 * - Compression (ranking does not remove content)
 *
 * The ranking result is consumed by future components like Compression
 * to decide which sections to keep, truncate, or remove.
 *
 * Design principles:
 * - Pure function: input → output, no side effects
 * - Non-mutating: never modifies the PromptContext
 * - Replaceable: unified interface for all ranking strategies
 * - No dependency on Planner, Provider, Runtime, or AgentLoop
 *
 * Future implementations:
 * - RuleBasedRanking     — fixed priority rules (current default)
 * - HeuristicRanking     — section length, recency, keyword matching
 * - EmbeddingRanking     — semantic similarity via embeddings
 * - LLMRanking           — LLM-based importance evaluation
 *
 * @see DefaultMemoryRanking — the default fixed-priority implementation
 * @see MemoryRankingResult — the output structure
 */
export interface MemoryRanking {
  /**
   * Rank sections of a PromptContext by priority/importance.
   *
   * Implementations MUST:
   * - NOT modify the input PromptContext
   * - Be idempotent (same input always produces same output)
   * - Be pure (no side effects)
   *
   * @param context — The PromptContext to rank
   * @returns A MemoryRankingResult with ranked sections and priority scores
   */
  rank(context: PromptContext): MemoryRankingResult
}