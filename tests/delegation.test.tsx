import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'delegation',
  component: 'Pane',
  requestId: 'delegation',
  surface: 'desktop',
  props: {
    title: 'Delegation',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('picked model reaches Agent calls; note reaches the prompt', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  let sessionRunning = false
  on('mcp.call', () => ({
    value: {
      content: [{ type: 'text', text: JSON.stringify([{ startedBy: 'me', isRunning: sessionRunning }]) }],
      isError: false,
    },
  }))
  let sent: unknown
  on('command.register', () => ({ value: { command: 'delegation' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) => {
    sent = e
    return { result: {} }
  })
  on('prompt.compose', () => ({ sections: [] }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'd', type: 'Explore', status: 'running' }] }))
  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(PANE)
  await ui.select({ key: 'agentModel', value: 'haiku' })
  await ui.select({ key: 'sessionModel', value: 'sonnet' })
  await ui.select({ key: 'sessionEffort', value: 'low' })
  await ui.input({ key: 'note', text: 'search: haiku', kind: 'submit' })
  await ui.unmount()

  await $.tool.call({ tool: 'Agent', description: 'x', prompt: 'y' })
  expect((sent as { model?: string }).model).toBe('haiku')

  await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 't' } as never)
  expect(sent).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'low' })
  await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 't', context: 'fork' } as never)
  expect((sent as { model?: string }).model).toBeUndefined()

  const BAND = {
    plugin: 'delegation', component: 'AbovePrompt', requestId: 'band', surface: 'desktop',
    props: { hasSurvey: false, isWorking: true, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 } },
  } as never

  let band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: /Delegation/ })).toBeUndefined()
  await band.unmount()

  await $.turn.start({ agentId: 'a1' } as never)
  band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Agents 1/ }))?.text).toContain('Agents 1 · haiku')
  await band.unmount()

  sessionRunning = true
  await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 't2' } as never)
  band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /Nested sessions 1/ }))?.text).toContain('Nested sessions 1 · sonnet · low')
  await band.unmount()
  sessionRunning = false
  await $.tool.call({ tool: 'mcp__ccd_session__start_session', title: 't3' } as never)

  await $.turn.complete({ agentId: 'a1' } as never)
  band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: /Delegation/ })).toBeUndefined()
  await band.unmount()

  const { sections } = await $.prompt.compose({
    model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [],
  })
  expect(sections.at(-1)?.text).toContain('search: haiku')
})
