import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Prefs } from '../types'

const PANE = 'delegation'
const AUTO = 'auto'
const MODELS = [AUTO, 'fable', 'opus', 'sonnet', 'haiku']
const EFFORTS = [AUTO, 'low', 'medium', 'high', 'xhigh', 'max']
const DEFAULTS: Prefs = {
  agentModel: AUTO,
  agentEffort: AUTO,
  workflowModel: AUTO,
  workflowEffort: AUTO,
  sessionModel: AUTO,
  note: '',
}

const prefs = atom({ plugin: 'delegation', key: 'prefs' } as const, DEFAULTS)

const set = (b: EngineInterface, patch: Partial<Prefs>) =>
  update(b, prefs, p => {
    const next = { ...p, ...patch }
    void b.store.set('prefs', next)
    return next
  })

const pick = (v: string) => (v === AUTO ? undefined : v)

const section = (p: Prefs) => {
  const lines = [
    `- Agent tool subagents: model ${p.agentModel}, effort ${p.agentEffort}`,
    `- Workflow agents: model ${p.workflowModel}, effort ${p.workflowEffort}. When writing a Workflow script, put these in every agent() call's opts unless "auto".`,
    `- New sessions (start_session): model ${p.sessionModel}`,
  ]
  const note = p.note.trim()
  return [
    'The user picked these models and effort levels for delegated work ("auto" means choose yourself). They override any default rule about which model agents use.',
    ...lines,
    note &&
      `The user's delegation note: follow it when splitting work into agents, workflow tasks or sessions (e.g. which model each kind of task gets):\n${note}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('prefs')) as Partial<Prefs> | undefined
    if (saved) await update($, prefs, () => ({ ...DEFAULTS, ...saved }))
    await $.command.register({
      name: 'delegation',
      description: 'Pick model/effort for agents, workflows and sessions',
    })
    return next(e)
  })

  on('command.run', { command: 'delegation' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Delegation' })
    return { text: 'Delegation pane opened.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const text = section(await read($, prefs))
    return {
      sections: [...out.sections, { id: 'delegation:prefs', text, scope: 'session' }],
    }
  })

  // Hard overrides where the tool takes the field; workflows rely on the prompt section.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const p = await read($, prefs)
    const model = pick(p.agentModel) as typeof e.model
    const effort = pick(p.agentEffort) as typeof e.effort
    return next({ ...e, ...(model && { model }), ...(effort && { effort }) })
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__ccd_session__start_session' }, async ($, e, next) => {
    const model = pick((await read($, prefs)).sessionModel)
    return next(model ? { ...e, model } : e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Open /delegation on desktop or terminal to edit.</Text>
    }
    const { Box, Text, Select, Input } = $.ui.resolve(e)
    const p = await read($, prefs)
    const sel = (key: keyof Prefs, label: string, list: string[]) => (
      <Select
        key={key}
        label={label}
        value={p[key]}
        options={list.map(value => ({ value }))}
        onSelect={value => set($, { [key]: value })}
      />
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Agents</Text>
        {sel('agentModel', 'Model', MODELS)}
        {sel('agentEffort', 'Effort', EFFORTS)}
        <Text bold>Workflow agents</Text>
        {sel('workflowModel', 'Model', MODELS)}
        {sel('workflowEffort', 'Effort', EFFORTS)}
        <Text bold>Nested sessions</Text>
        {sel('sessionModel', 'Model', MODELS)}
        <Text bold>Note (saved as you type, sent with every request)</Text>
        <Input
          key="note"
          rows={6}
          value={p.note}
          placeholder={'planning/review: opus high\ncoding: sonnet medium\nsearch/reading: haiku low'}
          submitLabel="save"
          onInput={note => set($, { note })}
          onSubmit={note => set($, { note })}
        />
      </Box>
    )
  })
}
