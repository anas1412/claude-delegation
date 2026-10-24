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
  let sent: unknown
  on('command.register', () => ({ value: { command: 'delegation' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) => {
    sent = e
    return { result: {} }
  })
  on('prompt.compose', () => ({ sections: [] }))

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

  const band = await $.ui.mount({
    plugin: 'delegation', component: 'AbovePrompt', requestId: 'band', surface: 'desktop',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 } },
  } as never)
  expect((await band.find({ type: 'Text', text: /Agents haiku/ }))?.text).toContain('Sessions sonnet · low')
  await band.unmount()

  const { sections } = await $.prompt.compose({
    model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [],
  })
  expect(sections.at(-1)?.text).toContain('search: haiku')
})
