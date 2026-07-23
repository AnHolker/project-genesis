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
import type { BuilderOptions } from './BuilderOptions'
import { DefaultPromptRenderer } from './DefaultPromptRenderer'
import { DefaultPromptCompression } from './DefaultPromptCompression'
import { DefaultMemoryRanking } from './DefaultMemoryRanking'
import { DefaultPromptBudget } from './DefaultPromptBudget'
import { DefaultPromptSelection } from './DefaultPromptSelection'
import { formatObservations as doFormat } from './modules/ObservationPromptModule'
import { formatReflectionResults as doFormatReflection } from './modules/ReflectionPromptModule'

export class DefaultPromptBuilder implements PromptBuilder {
  private readonly modules: PromptModule[]
  private readonly renderer: PromptRenderer
  private readonly compression: PromptCompression
  private readonly ranking: MemoryRanking
  private readonly budget: PromptBudget
  private readonly selection: PromptSelection
  private readonly providerBudget?: ProviderBudget
  private readonly configuration?: AIConfiguration

  /**
   * Create a DefaultPromptBuilder.
   *
   * Two constructor forms are supported:
   *
   * 1. **BuilderOptions form** (recommended):
   *    ```
   *    new DefaultPromptBuilder(modules, {
   *      renderer: myRenderer,
   *      compression: myCompression,
   *      configuration: myConfig,
   *    })
   *    ```
   *
   * 2. **Legacy positional form** (backward compatible):
   *    ```
   *    new DefaultPromptBuilder(modules, renderer, compression, ranking, budget, selection, providerBudget, configuration)
   *    ```
   */
  constructor(modules: PromptModule[], options?: BuilderOptions)
  constructor(
    modules: PromptModule[],
    renderer?: PromptRenderer,
    compression?: PromptCompression,
    ranking?: MemoryRanking,
    budget?: PromptBudget,
    selection?: PromptSelection,
    providerBudget?: ProviderBudget,
    configuration?: AIConfiguration,
  )
  constructor(
    modules: PromptModule[],
    rendererOrOptions?: PromptRenderer | BuilderOptions,
    compression?: PromptCompression,
    ranking?: MemoryRanking,
    budget?: PromptBudget,
    selection?: PromptSelection,
    providerBudget?: ProviderBudget,
    configuration?: AIConfiguration,
  ) {
    this.modules = modules
    if (rendererOrOptions !== undefined && !('render' in rendererOrOptions)) {
      // BuilderOptions form
      const opts = rendererOrOptions as BuilderOptions
      this.renderer = opts.renderer ?? new DefaultPromptRenderer()
      this.compression = opts.compression ?? new DefaultPromptCompression()
      this.ranking = opts.ranking ?? new DefaultMemoryRanking()
      this.budget = opts.budget ?? new DefaultPromptBudget()
      this.selection = opts.selection ?? new DefaultPromptSelection()
      this.providerBudget = opts.providerBudget
      this.configuration = opts.configuration
    } else {
      // Legacy positional form
      this.renderer = (rendererOrOptions as PromptRenderer | undefined) ?? new DefaultPromptRenderer()
      this.compression = compression ?? new DefaultPromptCompression()
      this.ranking = ranking ?? new DefaultMemoryRanking()
      this.budget = budget ?? new DefaultPromptBudget()
      this.selection = selection ?? new DefaultPromptSelection()
      this.providerBudget = providerBudget
      this.configuration = configuration
    }
  }

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