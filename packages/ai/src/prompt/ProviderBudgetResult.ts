/**
 * ProviderBudgetResult represents the token capacity of a specific
 * AI provider and model combination.
 *
 * This is a pure data type — no behavior, no dependencies.
 *
 * @property maxInputTokens — Maximum number of input tokens supported
 * @property maxOutputTokens — Optional maximum output tokens supported
 */
export interface ProviderBudgetResult {
  /** Maximum number of input tokens the provider/model supports */
  maxInputTokens: number

  /**
   * Maximum number of output tokens the provider/model supports.
   *
   * Optional because some providers or models may not publicly
   * document output token limits, or limits may vary by API version.
   */
  maxOutputTokens?: number
}