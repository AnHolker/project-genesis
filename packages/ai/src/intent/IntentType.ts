/**
 * Intent Type — extensible string union representing user intention categories.
 *
 * Foundation types:
 * - Create:    User wants to create something new
 * - Delete:    User wants to remove something
 * - Move:      User wants to relocate something
 * - Modify:    User wants to change properties of something
 * - Query:     User wants to retrieve information
 *
 * Future types must be additive (union extension, never removal).
 */
export type IntentType =
  | 'Create'
  | 'Delete'
  | 'Move'
  | 'Modify'
  | 'Query'