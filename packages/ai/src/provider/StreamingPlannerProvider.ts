import type { AIRequest } from '../request'
import type { PlannerProvider } from './PlannerProvider'

/**
 * StreamingPlannerProvider extends PlannerProvider with a stream() method.
 *
 * Providers that implement this interface support both:
 * - complete(request) → Promise<PlannerResult>   (synchronous, original interface)
 * - stream(request)   → AsyncIterable<string>     (text chunks as they arrive)
 *
 * Backward compatible: any code consuming PlannerProvider continues to work.
 * Code that needs streaming checks for StreamingPlannerProvider at runtime.
 */
export interface StreamingPlannerProvider extends PlannerProvider {
  /**
   * Stream the LLM response as an AsyncIterable of text chunks.
   *
   * Each chunk is a raw text fragment from the LLM, emitted as the response
   * is being generated. No JSON parsing is performed on individual chunks.
   */
  stream(request: AIRequest): AsyncIterable<string>
}