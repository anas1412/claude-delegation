import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Prefs } from '../types'

const PANE = 'delegation'
const AUTO = 'auto'
const MODELS = [AUTO, 'fable', 'opus', 'sonnet', 'haiku']
const EFFORTS = [AUTO, 'low', 'medium', 'high', 'xhigh', 'max']
// start_session takes full ids, not aliases.
const MODEL_IDS: Record<string, string> = {
  fable: 'claude-fable-5-1',
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
}
const DEFAULTS: Prefs = {
  agentModel: AUTO,
  agentEffort: AUTO,
  workflowModel: AUTO,
  workflowEffort: AUTO,
  sessionModel: AUTO,
  sessionEffort: AUTO,
  note: '',
}

type Group = {
  title: string
  hint: string
  model: keyof Prefs
  effort: keyof Prefs
}
const GROUPS: Group[] = [
  {
    title: 'Agents',
    hint: 'Subagents Claude starts with the Agent tool. Enforced.',
    model: 'agentModel',
    effort: 'agentEffort',
  },
  {
    title: 'Workflow agents',
    hint: 'Each agent() in a workflow script. Sent as instructions: Workflow has no model field to enforce.',
    model: 'workflowModel',
    effort: 'workflowEffort',
  },
  {
    title: 'Nested sessions',
    hint: 'New sessions Claude starts. Enforced on fresh sessions, capped at this session’s model and effort; forks inherit.',
    model: 'sessionModel',
    effort: 'sessionEffort',
  },
]

const prefs = atom({ plugin: 'delegation', key: 'prefs' } as const, DEFAULTS)

const set = (b: EngineInterface, patch: Partial<Prefs>) =>
  update(b, prefs, p => {
    const next = { ...p, ...patch }
    void b.store.set('prefs', next)
    return next
  })

const pick = (v: string) => (v === AUTO ? undefined : v)

const label = (p: Prefs, g: Group) =>
  [p[g.model], p[g.effort]].filter(v => v !== AUTO).join(' · ') || AUTO

const section = (p: Prefs) => {
  const note = p.note.trim()
  return [
    'The user picked these models and effort levels for delegated work ("auto" means choose yourself). They override any default rule about which model agents use.',
    `- Agent tool subagents: model ${p.agentModel}, effort ${p.agentEffort}`,
    `- Workflow agents: model ${p.workflowModel}, effort ${p.workflowEffort}. When writing a Workflow script, put these in every agent() call's opts unless "auto".`,
    `- New sessions (start_session): model ${p.sessionModel}, effort ${p.sessionEffort}`,
    note &&
      `The user's delegation note: follow it when splitting work into agents, workflow tasks or sessions (e.g. which model each kind of task gets):\n${note}`,
  ]
    .filter(Boolean)
    .join('\n')
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Delegation' })

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
    await openPane($)
    return { text: 'Delegation pane opened.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const text = section(await read($, prefs))
    return {
      sections: [...out.sections, { id: 'delegation:prefs', text, scope: 'session' }],
    }
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const p = await read($, prefs)
    const model = pick(p.agentModel) as typeof e.model
    const effort = pick(p.agentEffort) as typeof e.effort
    return next({ ...e, ...(model && { model }), ...(effort && { effort }) })
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__ccd_session__start_session' }, async ($, e, next) => {
    const input = e as typeof e & { context?: string; proposal_id?: string }
    // model/effort apply to fresh sessions only; a proposal starts exactly as proposed.
    if (input.context === 'fork' || input.proposal_id) return next(e)
    const p = await read($, prefs)
    const model = pick(p.sessionModel)
    const effort = pick(p.sessionEffort)
    return next({
      ...e,
      ...(model && { model: MODEL_IDS[model] }),
      ...(effort && { effort }),
    })
  }).catch(($, e, next) => next(e))

  // The footer line under the prompt, beside the permission mode picker.
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={2}>
        {e.props.hint !== '' && <Text dimColor>{e.props.hint}</Text>}
        <Button key="open" plain onPress={() => openPane($)}>
          Delegation
        </Button>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Open /delegation on desktop or terminal to edit.</Text>
    }
    const { Box, Text, Select, Input, Button } = $.ui.resolve(e)
    const p = await read($, prefs)
    const select = (key: keyof Prefs, title: string, list: string[]) => (
      <Select
        key={key}
        label={title}
        value={p[key]}
        options={list.map(value => ({ value, label: value === AUTO ? 'Auto' : value }))}
        onSelect={value => set($, { [key]: value })}
      />
    )
    const hasNote = p.note.trim() !== ''
    const isDefault = JSON.stringify(p) === JSON.stringify(DEFAULTS)

    return (
      <Box flexDirection="column" gap="md">
        <Text dimColor size="footnote">
          Choose how Claude delegates. Auto leaves the choice to Claude.
        </Text>

        {GROUPS.map(g => {
          const value = label(p, g)
          const isAuto = value === AUTO
          return (
            <Box
              key={g.title}
              flexDirection="column"
              gap="sm"
              padding="sm"
              borderStyle="round"
              borderColor={isAuto ? 'subtle' : 'claude'}
            >
              <Box flexDirection="row" justifyContent="space-between">
                <Text weight="semibold">{g.title}</Text>
                <Text size="caption" color={isAuto ? 'subtle' : 'claude'}>
                  {isAuto ? 'Auto' : value}
                </Text>
              </Box>
              <Text dimColor size="caption">
                {g.hint}
              </Text>
              <Box flexDirection="row" flexWrap="wrap" gap="md">
                {select(g.model, 'Model', MODELS)}
                {select(g.effort, 'Effort', EFFORTS)}
              </Box>
            </Box>
          )
        })}

        <Box
          flexDirection="column"
          gap="sm"
          padding="sm"
          borderStyle="round"
          borderColor={hasNote ? 'claude' : 'subtle'}
        >
          <Box flexDirection="row" justifyContent="space-between">
            <Text weight="semibold">Delegation note</Text>
            <Text size="caption" color={hasNote ? 'success' : 'subtle'}>
              {hasNote ? 'Saved' : 'Empty'}
            </Text>
          </Box>
          <Text dimColor size="caption">
            Sent with every request. Say which model each kind of task should get.
          </Text>
          <Input
            key="note"
            rows={5}
            value={p.note}
            placeholder={'planning/review: opus high\ncoding: sonnet medium\nsearch/reading: haiku low'}
            submitLabel="save"
            onInput={note => set($, { note })}
            onSubmit={note => set($, { note })}
          />
        </Box>

        {!isDefault && (
          <Box flexDirection="row" justifyContent="flex-end">
            <Button key="reset" label="Reset all" onPress={() => set($, DEFAULTS)} />
          </Box>
        )}
      </Box>
    )
  })
}
