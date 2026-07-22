import type { PipelineContext } from '../../pipeline'
import type { PromptContext } from '../PromptContext'

export interface PromptModule {
  build(context: PipelineContext): Promise<string>

  /**
   * Optional: produce structured PromptContext data.
   *
   * When implemented, this method returns the module's contribution as a
   * structured Partial<PromptContext> instead of a raw string. This enables
   * the PromptBuilder to compose the prompt from structured data rather than
   * raw string fragments.
   *
   * Modules that do not implement this method fall back to the build() method.
   * This ensures backward compatibility with legacy modules.
   *
   * @param context — The PipelineContext to extract data from
   * @returns A Partial<PromptContext> with only this module's fields
   */
  buildContext?(context: PipelineContext): Promise<Partial<PromptContext>>
}