# ADR-0049: Rule-Based Intent Analyzer

**Status:** Accepted  
**Date:** Sprint 5  
**Work Order:** WO-S5-002  
**Architecture Version:** v0.37

---

## Context

WO-S5-001 (ADR-0048) established the Intent Analysis Foundation with `IntentAnalyzer` interface and `DefaultIntentAnalyzer` placeholder. The placeholder returns `{ intents: [] }` for every input — it is a no-op that satisfies the interface but provides no actual functionality.

Sprint 5 requires a working intent analyzer that can detect user intentions from natural language input. The first production implementation is a keyword-based rule engine — no LLM, no embeddings, no external dependencies.

### Problem

1. **DefaultIntentAnalyzer is a no-op** — returns empty for every input
2. **No intent detection capability exists** — no component can answer "what does the user want?"
3. **Future LLM-based analysis needs a baseline** — rule-based provides a deterministic, zero-cost fallback for LLM-based approaches to improve upon

### Constraints

1. **No LLM** — All detection is rule-based keyword matching
2. **No dependencies** — Must not import Planner, Runtime, Provider, Memory, ToolCalling, AgentLoop, PromptBuilder, or Pipeline
3. **Pure, stateless, deterministic** — Same input always produces same output. No side effects.
4. **No modifications to existing interfaces** — Intent, IntentType, IntentResult, IntentAnalyzer remain unchanged
5. **Backward compatible** — DefaultIntentAnalyzer continues working unchanged
6. **Implements IntentAnalyzer** — Must implement the existing interface, not modify it

---

## Decision

### 1. New Module: `packages/ai/src/intent/RuleBasedIntentAnalyzer.ts`

A keyword-based intent analyzer that maps natural language keywords to `IntentType` values.

### 2. Keyword Mapping

| IntentType | Chinese Keywords | English Keywords |
|-----------|-----------------|------------------|
| `Create` | 创建, 生成, 画, 添加, 放一个, 放一棵 | spawn, create, draw, add, make |
| `Delete` | 删除, 移除, 清除 | remove, delete |
| `Move` | 移动, 挪 | move, translate |
| `Modify` | 修改, 改变, 编辑 | replace, change |
| `Query` | 查询, 看看, 有什么 | what, show, list |

### 3. Intent Detection Algorithm

```
analyze(input):
  1. Trim input — return empty if blank
  2. Split input by separators (， 、 。 , . 再 然后 and then)
  3. For each segment:
     a. Lowercase for case-insensitive matching
     b. Scan all keywords in INTENT_ORDER priority
     c. If keyword found → add IntentType
  4. Deduplicate — first occurrence preserved, duplicates removed
  5. Return IntentResult with unique intents in input order
```

### 4. Multi-Intent Support

Input is split by known separators before keyword matching:

- Chinese separators: `，` `、` `。` `再` `然后` `接着`
- English separators: `,` `.` `and` `then`

Example:
```
Input:  "画一棵树，再删除花"
Split: ["画一棵树", "删除花"]
Match: [Create, Delete]
```

### 5. Duplicate Removal

When multiple segments produce the same IntentType, only the first occurrence is preserved. Order is maintained.

Example:
```
Input:  "draw tree, draw flower"
Split: ["draw tree", "draw flower"]
Match: [Create, Create]
Result: [Create]  (deduplicated)
```

### 6. Unknown Input

When no keywords match, returns `{ intents: [] }`. Never throws.

### 7. Case Insensitivity

English keywords are matched case-insensitively:
- `"DRAW TREE"` → Create
- `"Draw Tree"` → Create
- `"draw tree"` → Create

### 8. Exports

`RuleBasedIntentAnalyzer` exported from:
- `packages/ai/src/intent/index.ts`
- `packages/ai/src/index.ts` (package root)

---

## Consequences

**Positive:**
- First working IntentAnalyzer implementation — detects all 5 intent types
- Pure, stateless, deterministic — same input always produces same output
- Zero dependencies — no imports from Planner, Runtime, Provider, Memory, or ToolCalling
- Backward compatible — DefaultIntentAnalyzer unchanged
- Multi-intent detection works for both Chinese and English input
- Case-insensitive English matching
- Duplicate removal prevents redundant intents
- Unknown input returns empty result (never throws)
- All existing interfaces unchanged — Intent, IntentType, IntentResult, IntentAnalyzer frozen

**Negative:**
- Rule-based only — cannot detect intents outside keyword coverage
- Chinese keyword matching is substring-based — may have false positives with homophones
- Separator-based multi-intent detection is limited to known separators

**Neutral:**
- `RuleBasedIntentAnalyzer` added to public API
- Architecture version bumped to v0.37
- 93 new tests — full coverage of intent recognition, multi-intent, dedup, unknown, deterministic, stateless, compatibility

---

## Future Work (Not Implemented)

| Capability | Description |
|-----------|-------------|
| LLMIntentAnalyzer | LLM-based semantic intent analysis |
| HybridIntentAnalyzer | Rule-based with LLM fallback |
| Rule Builder | Configurable keyword rules |
| Intent Confidence | Score-based intent detection |
| Intent → PromptAssembly | Integrate intents into PromptContext |

---

## References

- ADR-0048: Intent Analysis Foundation
- WO-S5-001: Intent Analysis Foundation
- WO-S5-002: Rule-Based Intent Analyzer (this Work Order)
- `docs/project/AI_ARCHITECTURE.md` — Architecture reference
- `docs/project/PROJECT_STATE.md` — Current project state