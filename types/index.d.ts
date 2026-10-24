export type Prefs = {
  agentModel: string
  agentEffort: string
  workflowModel: string
  workflowEffort: string
  sessionModel: string
  note: string
}

declare module 'claude-code' {
  interface PluginState {
    delegation: { prefs: Prefs }
  }
}
