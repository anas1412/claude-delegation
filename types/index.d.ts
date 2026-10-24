export type Prefs = {
  agentModel: string
  agentEffort: string
  workflowModel: string
  workflowEffort: string
  sessionModel: string
  sessionEffort: string
  note: string
}

export type Running = { agents: number; workflow: number; sessions: number }

declare module 'claude-code' {
  interface PluginState {
    delegation: { prefs: Prefs; running: Running }
  }
}
