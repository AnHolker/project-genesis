# ADR-0016: Structured Output Validator

**Status:** Accepted  
**Date:** Sprint 2  
**Architecture Version:** v0.8

---

## Context

OpenAIPlannerProvider and DeepSeekPlannerProvider each contained inline response parsing logic. Both performed the same steps:

1. `JSON.parse(content)` — parse raw text into an object
2. Check `actions` is an array
3. Filter out entries without a `type` field
4. Return `{ actions: [...] }` or `{ actions: [], reasoning: "..." }`

This logic was duplicated across two providers. A third provider would duplicate it again.

More critically, the inline parsing was lenient — it only checked `typeof raw.type === 'string'`. It did not validate that `CreateEntity` actions had `entityType`, `x`, `y` fields, or that `MoveEntity` actions had `id`, `x`, `y` fields. Malformed actions could pass through to Runtime and fail at handler dispatch with no useful error message.

Without a unified validator:
- Adding validation rules required editing every provider
- Validation consistency depended on developer discipline
- Invalid actions reached Runtime and failed silently

---

## Decision

Introduce `StructuredOutputValidator` as a static validation class:

```typescript
class StructuredOutputValidator {
  static validate(input: unknown): PlannerResult
}
```

All LLM providers must pass parsed responses through this validator before returning.

The validator performs:
1. Root object check — `input` must be a non-null, non-array object
2. `actions` field check — must be an array
3. Per-action type dispatch — validates known action types (CreateEntity, MoveEntity) against their required fields
4. Unknown action types are filtered out
5. Returns `{ actions: validActions }` or `{ actions: validActions, reasoning: "..." }` with error details

This replaces all inline parsing in providers. Providers still own `JSON.parse()` and error catching, but validation logic lives in one place.

---

## Consequences

**Positive:**
- Single point of validation — adding a new action type requires changing one file
- Field-level validation catches malformed actions before they reach Runtime
- All LLM providers share identical validation behavior
- Provider code becomes simpler — only `JSON.parse()` + `StructuredOutputValidator.validate()`

**Negative:**
- Adding a new action type requires updating the validator's `switch(type)` — a new handler in Runtime does not automatically get validation
- `StructuredOutputValidator` has a compile-time dependency on action type knowledge (it knows about CreateEntity and MoveEntity fields)
- MockPlannerProvider bypasses the validator — it constructs trusted actions directly (acceptable: mock output is deterministic)

**Neutral:**
- The validator is stateless and static — no instance management needed
- Validation is strict: unknown action types are rejected, not passed through
