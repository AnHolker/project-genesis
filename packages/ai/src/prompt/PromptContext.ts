import type { PipelineContext } from '../pipeline'

/**
 * PromptContext is a structured data type representing all prompt sections.
 *
 * Each field corresponds to a section type that a PromptModule can produce.
 * Fields are optional — only populated sections are present.
 *
 * This is the intermediate representation between PromptModule and the final
 * prompt string. DefaultPromptBuilder collects PromptContext from modules'
 * buildContext() results, then serializes to the final prompt string.
 *
 * Design principles:
 * - Simple: only known, needed fields
 * - Minimal: no speculation about future fields
 * - Independent: no dependencies on AgentLoop, Planner, or other components
 *
 * @property system — System prompt instructions (from SystemPromptModule)
 * @property userInput — Raw user input text (from UserInputModule)
 * @property memory — Conversation history (from MemoryPromptModule)
 * @property worldState — Current world snapshot (from WorldStatePromptModule)
 * @property observations — Structured tool observations (from ObservationPromptModule)
 * @property reflections — Reflection evaluation results (from ReflectionPromptModule)
 */
export interface PromptContext {
  /** System prompt instructions */
  system?: string

  /** Raw user input text */
  userInput?: string

  /** Conversation history */
  memory?: string

  /** Current world snapshot */
  worldState?: string

  /** Structured tool observations */
  observations?: string

  /** Reflection evaluation results */
  reflections?: string
}

/**
 * Serialize a PromptContext to a prompt string.
 *
 * Sections are rendered in the defined canonical order.
 * Empty or undefined sections are rendered as empty strings (preserving
 * the spacing behavior from module array joining).
 *
 * @param ctx — The PromptContext to serialize
 * @returns The serialized prompt string with sections joined by '\n'
 */
export function serializePromptContext(ctx: PromptContext): string {
  const order: Array<keyof PromptContext> = [
    'system',
    'userInput',
    'memory',
    'reflections',
    'worldState',
    'observations',
  ]

  // Check if any field is present — return empty if none
  const hasContent = order.some((key) => ctx[key] !== undefined && ctx[key] !== '')
  if (!hasContent) return ''

  return order
    .map((key) => ctx[key] ?? '')
    .join('\n')
}