import type { PromptRenderer } from './PromptRenderer'
import type { PromptContext } from './PromptContext'

/**
 * DefaultPromptRenderer is the canonical implementation of PromptRenderer.
 *
 * It renders PromptContext fields in insertion order (the order in which
 * the builder added fields to the PromptContext object). This preserves
 * the module array ordering used by DefaultPromptBuilder.
 *
 * For canonical order rendering (used by serializePromptContext),
 * use DefaultPromptRenderer.renderWithOrder().
 *
 * This is the default renderer used by DefaultPromptBuilder.
 * All prompt text output in the system must go through a PromptRenderer.
 *
 * @see serializePromptContext — backward-compatible wrapper
 */
export class DefaultPromptRenderer implements PromptRenderer {
  /**
   * The canonical field order for rendering PromptContext sections.
   * Used by renderWithOrder() and serializePromptContext().
   */
  static readonly CANONICAL_ORDER: Array<keyof PromptContext> = [
    'system',
    'userInput',
    'memory',
    'reflections',
    'worldState',
    'observations',
  ]

  /**
   * Render a PromptContext to a string, preserving the insertion order
   * of fields as they were added by the builder.
   *
   * @param context — The structured PromptContext to render
   * @returns The rendered prompt string with sections joined by '\n'
   */
  render(context: PromptContext): string {
    const keys = Object.keys(context) as Array<keyof PromptContext>

    // Only include keys that exist in PromptContext
    const promptKeys = keys.filter((key) =>
      DefaultPromptRenderer.CANONICAL_ORDER.includes(key),
    )

    // Check if any field has content — return empty if none
    const hasContent = promptKeys.some(
      (key) => context[key] !== undefined && context[key] !== '',
    )
    if (!hasContent) return ''

    return promptKeys
      .map((key) => context[key] ?? '')
      .join('\n')
  }

  /**
   * Render a PromptContext using the canonical field order.
   * This ensures consistent output regardless of how fields were added.
   *
   * Used internally by serializePromptContext for backward compatibility.
   *
   * @param context — The structured PromptContext to render
   * @returns The rendered prompt string with sections joined by '\n'
   */
  renderWithOrder(context: PromptContext): string {
    const order = DefaultPromptRenderer.CANONICAL_ORDER

    // Check if any field is present — return empty if none
    const hasContent = order.some(
      (key) => context[key] !== undefined && context[key] !== '',
    )
    if (!hasContent) return ''

    return order
      .map((key) => context[key] ?? '')
      .join('\n')
  }
}