import type { IntentAnalyzer } from './IntentAnalyzer'
import type { IntentResult } from './IntentResult'
import type { IntentType } from './IntentType'

/**
 * Keyword mapping from normalized keyword → IntentType.
 * All keywords are lowercase for case-insensitive matching.
 * Each keyword maps to exactly one intent type.
 */
const KEYWORD_MAP: Record<string, IntentType> = {
  // Create
  创建: 'Create',
  生成: 'Create',
  画: 'Create',
  添加: 'Create',
  '放一个': 'Create',
  '放一棵': 'Create',
  spawn: 'Create',
  create: 'Create',
  draw: 'Create',
  add: 'Create',
  make: 'Create',

  // Delete
  删除: 'Delete',
  移除: 'Delete',
  清除: 'Delete',
  remove: 'Delete',
  delete: 'Delete',

  // Move
  移动: 'Move',
  挪: 'Move',
  move: 'Move',
  translate: 'Move',

  // Modify
  修改: 'Modify',
  改变: 'Modify',
  编辑: 'Modify',
  replace: 'Modify',
  change: 'Modify',

  // Query
  查询: 'Query',
  看看: 'Query',
  有什么: 'Query',
  what: 'Query',
  show: 'Query',
  list: 'Query',
}

/**
 * Intent type order for deterministic matching.
 * Determines which intent type wins when a segment matches multiple keywords.
 */
const INTENT_ORDER: IntentType[] = ['Create', 'Delete', 'Move', 'Modify', 'Query']

/**
 * Chinese and English separators for multi-intent detection.
 * Ordered by priority — longer/more specific separators first to avoid
 * partial matches (e.g., " and " before "and").
 */
const SEPARATORS = [
  // English conjunctions (with spaces for word boundaries)
  ', then ',
  ', and ',
  ' and ',
  ' then ',
  ' but ',
  ' also ',

  // Chinese conjunctions
  '再然后',
  '然后再',
  '再',
  '然后',
  '接着',
  '并且',
  '也',

  // Chinese punctuation
  '，',
  '、',
  '。',

  // English punctuation (with space for boundary)
  ', ',
  '. ',
]

/**
 * RuleBasedIntentAnalyzer — production-ready keyword-based intent analyzer.
 *
 * Detects user intentions from natural language using keyword matching.
 * Supports:
 *   - All 5 foundation intent types (Create, Delete, Move, Modify, Query)
 *   - Multi-intent detection via separator-based segmentation
 *   - Duplicate removal (first occurrence preserved, order maintained)
 *   - Case-insensitive English matching
 *   - Chinese and English keywords
 *   - Unknown/empty input returns empty result
 *
 * Pure, stateless, deterministic — no I/O, no LLM, no external dependencies.
 * Implements IntentAnalyzer interface.
 */
export class RuleBasedIntentAnalyzer implements IntentAnalyzer {
  analyze(input: string): IntentResult {
    const trimmed = input.trim()
    if (trimmed.length === 0) {
      return { intents: [] }
    }

    // Split into segments for multi-intent detection
    const segments = this.splitInput(trimmed)

    const seen = new Set<IntentType>()
    const result: IntentType[] = []

    for (const segment of segments) {
      if (segment.length === 0) continue

      const matched = this.matchIntent(segment)
      if (matched !== null && !seen.has(matched)) {
        seen.add(matched)
        result.push(matched)
      }
    }

    return { intents: result.map(type => ({ type })) }
  }

  /**
   * Match a single text segment against keyword rules.
   * Returns the IntentType of the first matching keyword, or null if no match.
   */
  private matchIntent(text: string): IntentType | null {
    const lower = text.toLowerCase()

    for (const intentType of INTENT_ORDER) {
      for (const [keyword, type] of Object.entries(KEYWORD_MAP)) {
        if (type !== intentType) continue
        if (lower.includes(keyword)) {
          return type
        }
      }
    }

    return null
  }

  /**
   * Split input text into segments for multi-intent detection.
   * Iteratively applies known separators to produce intent-bearing segments.
   */
  private splitInput(input: string): string[] {
    let segments = this.splitOnce(input)
    if (segments.length <= 1) {
      return segments
    }

    // Further split any remaining compound segments
    let previous: string[]
    do {
      previous = segments
      const next: string[] = []
      for (const seg of segments) {
        const sub = this.splitOnce(seg)
        next.push(...sub)
      }
      segments = next
    } while (segments.length > previous.length && segments.length < 20)

    return segments
  }

  /**
   * Split a single string using the first matching separator.
   */
  private splitOnce(input: string): string[] {
    const lower = input.toLowerCase()

    for (const sep of SEPARATORS) {
      if (lower.includes(sep)) {
        // Find the actual occurrence (preserve original casing for matching)
        const idx = input.toLowerCase().indexOf(sep)
        if (idx === -1) continue

        const before = input.slice(0, idx).trim()
        const after = input.slice(idx + sep.length).trim()

        const parts = [before, after].filter(p => p.length > 0)
        if (parts.length > 1) {
          return parts
        }
      }
    }

    return [input]
  }
}