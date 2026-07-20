import { describe, it, expect } from 'vitest'
import { DefaultPromptBuilder } from '../prompt/DefaultPromptBuilder'
import { SystemPromptModule, UserInputModule, MemoryPromptModule, WorldStatePromptModule } from '../prompt/modules'
import { DefaultMemory } from '../memory/DefaultMemory'
import type { PipelineContext } from '../pipeline/PipelineContext'

describe('PromptBuilder Snapshot', () => {
  // --- Test 1: SystemPromptModule only ---
  it('should match snapshot for SystemPromptModule only', async () => {
    const builder = new DefaultPromptBuilder([new SystemPromptModule()])
    const context: PipelineContext = { input: '' }

    const request = await builder.build(context)

    expect(request.prompt).toMatchSnapshot()
  })

  // --- Test 2: SystemPromptModule + UserInputModule ---
  it('should match snapshot for SystemPromptModule with UserInputModule', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
    ])
    const context: PipelineContext = { input: '增加一棵树' }

    const request = await builder.build(context)

    expect(request.prompt).toMatchSnapshot()
  })

  // --- Test 3: All modules with single memory ---
  it('should match snapshot for all modules with single memory', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created a tree' },
    ])
    const context: PipelineContext = {
      input: '增加一棵树',
      memory,
      worldState: 'Tree\nid: tree-1\nposition: (3,5)',
    }

    const request = await builder.build(context)

    expect(request.prompt).toMatchSnapshot()
  })

  // --- Test 4: All modules with multiple memory entries ---
  it('should match snapshot for all modules with multiple memory entries', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add a house', summary: 'Created a house at (3, 5)' },
      { input: 'move house', summary: 'Moved house to (7, 9)' },
      { input: 'add a tree', summary: 'Created a tree at (2, 2)' },
    ])
    const context: PipelineContext = {
      input: 'move tree',
      memory,
      worldState: 'House\nid: house-1\nposition: (3,5)\n\nTree\nid: tree-1\nposition: (2,2)',
    }

    const request = await builder.build(context)

    expect(request.prompt).toMatchSnapshot()
  })

  // --- Test 5: Empty memory + empty world ---
  it('should not include "Previous conversation" when memory is empty, and skip world when empty', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [])

    const context: PipelineContext = { input: '增加一棵树', memory }

    const request = await builder.build(context)

    expect(request.prompt).not.toContain('Previous conversation')
    expect(request.prompt).not.toContain('Current World')
    expect(request.prompt).toMatchSnapshot()
  })

  // --- Test 6: PromptModule order is preserved ---
  it('should preserve module order: System > User > Memory > World', async () => {
    const builder = new DefaultPromptBuilder([
      new SystemPromptModule(),
      new UserInputModule(),
      new MemoryPromptModule(),
      new WorldStatePromptModule(),
    ])
    const memory = new DefaultMemory()
    await memory.set('conversation', [
      { input: 'add tree', summary: 'Created a tree' },
    ])
    const context: PipelineContext = {
      input: '增加一棵树',
      memory,
      worldState: 'Tree\nid: tree-1\nposition: (3,5)',
    }

    const request = await builder.build(context)

    const prompt = request.prompt
    const sysIndex = prompt.indexOf('Project Genesis')
    const userIndex = prompt.indexOf('增加一棵树')
    const memoryIndex = prompt.indexOf('Previous conversation')
    const worldIndex = prompt.indexOf('Current World')

    expect(sysIndex).toBeLessThan(userIndex)
    expect(userIndex).toBeLessThan(memoryIndex)
    expect(memoryIndex).toBeLessThan(worldIndex)
  })
})