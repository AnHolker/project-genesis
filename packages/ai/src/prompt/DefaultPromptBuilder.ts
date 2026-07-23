import type { PromptBuilder } from './PromptBuilder'
import type { PromptModule } from './modules'
import type { PipelineContext } from '../pipeline'
import type { AIRequest } from '../request'
import type { PromptContext } from './PromptContext'
import type { PromptRenderer } from './PromptRenderer'
import type { PromptCompression } from './PromptCompression'
import type { MemoryRanking } from './MemoryRanking'
import type { PromptBudget } from './PromptBudget'
import type { PromptSelection } from './PromptSelection'
import type { PromptSelectionResult } from './PromptSelectionResult'
import type { PromptBudgetResult } from './PromptBudgetResult'
import type { MemoryRankingResult } from './MemoryRankingResult'
import type { ProviderBudget } from './ProviderBudget'
import type { ProviderBudgetResult } from './ProviderBudgetResult'
import type { AIConfiguration } from '../config'
import type { Observation } from '../agent'
import type { ReflectionResult } from '../reflection'
import { DefaultPromptRenderer } from './DefaultPromptRenderer'
import { DefaultPromptCompression } from './DefaultPromptCompression'
import { DefaultMemoryRanking } from './DefaultMemoryRanking'
import { DefaultPromptBudget } from './DefaultPromptBudget'
import { DefaultPromptSelection } from './DefaultPromptSelection'
import { formatObservations as doFormat } from './modules/ObservationPromptModule'
import { formatReflectionResults as doFormatReflection } from './modules/ReflectionPromptModule'

export class DefaultPromptBuilder implements PromptBuilder {
  constructor(
    private readonly modules: PromptModule[],
    private readonly renderer: PromptRenderer = new DefaultPromptRenderer(),
    private readonly compression: PromptCompression = new DefaultPromptCompression(),
    private readonly ranking: MemoryRanking = new DefaultMemoryRanking(),
    private readonly budget: PromptBudget = new DefaultPromptBudget(),
    private readonly selection: PromptSelection = new DefaultPromptSelection(),
    private readonly providerBudget?: ProviderBudget,
    private readonly configuration?: AIConfiguration,
  ) {}

  async build(context: PipelineContext): Promise<AIRequest> {
    const promptContext: PromptContext = {}
    const legacySections: string[] = []

    for (const module of this.modules) {
      // Collect structured context if available
      if ('buildContext' in module && typeof module.buildContext === 'function') {
        const ctx = await module.buildContext(context)
        Object.assign(promptContext, ctx)
      } else {
        // Legacy module fallback: use build() for the raw string
        legacySections.push(await module.build(context))
      }
    }

    // Phase 1: MemoryRanking — determine section priority (pure measurement)
    const rankingResult: MemoryRankingResult = this.ranking.rank(promptContext)

    // Phase 2: PromptBudget — calculate section sizes (pure measurement)
    const budgetResult: PromptBudgetResult = this.budget.calculate(promptContext)

    // Phase 2.5: ProviderBudget — look up provider/model capacity (pure lookup)
    // Uses AIConfiguration when available, otherwise falls back to defaults
    let providerBudgetResult: ProviderBudgetResult | undefined
    if (this.providerBudget !== undefined) {
      const provider = this.configuration?.provider ?? 'openai'
      const model = this.configuration?.model
      providerBudgetResult = this.providerBudget.getBudget(provider, model)
    }

    // Phase 3: PromptSelection — decide which sections to preserve (pure decision)
    const selectionResult: PromptSelectionResult = this.selection.select(
      promptContext,
      rankingResult,
      budgetResult,
      providerBudgetResult,
    )

    // Phase 4: PromptCompression — clean up context (consumes selection result)
    const compressed = this.compression.compress(promptContext, selectionResult)

    // Phase 6: PromptRenderer — convert to string
    const rendered = this.renderer.render(compressed)

    // Build metadata with assembly info
    const metadata: Record<string, unknown> = {
      ...(context.metadata ?? {}),
      promptAssembly: {
        ranking: rankingResult,
        budget: budgetResult,
        selection: selectionResult,
        ...(providerBudgetResult !== undefined ? { providerBudget: providerBudgetResult } : {}),
      },
    }

    // Append legacy module output if any
    if (legacySections.length > 0) {
      const allParts = [rendered, ...legacySections].filter(Boolean)
      return { prompt: allParts.join('\n'), metadata }
    }

    return { prompt: rendered, metadata }
  }

  /**
   * Get the structured PromptContext for the given PipelineContext.
   */
  async buildContext(context: PipelineContext): Promise<PromptContext> {
    const promptContext: PromptContext = {}

    for (const module of this.modules) {
      if ('buildContext' in module && typeof module.buildContext === 'function') {
        const ctx = await module.buildContext(context)
        Object.assign(promptContext, ctx)
      }
    }

    // Full assembly pipeline
    const rankingResult = this.ranking.rank(promptContext)
    const budgetResult = this.budget.calculate(promptContext)

    // ProviderBudget: only when injected
    let providerBudgetResult: ProviderBudgetResult | undefined
    if (this.providerBudget !== undefined) {
      const provider = this.configuration?.provider ?? 'openai'
      const model = this.configuration?.model
      providerBudgetResult = this.providerBudget.getBudget(provider, model)
    }

    const selectionResult = this.selection.select(promptContext, rankingResult, budgetResult, providerBudgetResult)

    // Apply compression (consumes selection result)
    return this.compression.compress(promptContext, selectionResult)
  }

  /**
   * Convert structured Observation[] to formatted prompt text.
   */
  formatObservations(observations: Observation[]): string {
    return doFormat(observations)
  }

  /**
   * Convert structured ReflectionResult[] to formatted prompt text.
   */
  formatReflectionResults(results: ReflectionResult[]): string {
    return doFormatReflection(results)
  }
}