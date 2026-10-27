export type DiscoverySnapshot = { id: string; databaseName: string; capturedAt: string; objects: readonly { objectId: number; schema: string; name: string; type: string; columns: readonly unknown[] }[]; foreignKeys: readonly unknown[]; indexes: readonly unknown[] }
export type AnalysisEvidence = { status: string; fixture: boolean; at: string; snapshotId: string; queryStore: string }
import type { SetupConnection } from './databaseTargets'

export type CapabilityDraft = {
  name: string; exampleQuestion: string; description: string; businessDecision: string
  definitions: string; ambiguities: string; group: string; origin: string; reason: string
  limitations: string; intent: unknown; parameters: unknown[]; mapping: string[]
  expectedRowsHash: string | null; modelReference: string | null
  mappingCatalog?: unknown; parameterAuthorization?: unknown
  chart_preference?: import('./chartModel').ChartPreference | null
}
export type CapabilityTest = {
  revision?: number; result: string; code: string; fixture?: boolean
  auditRequestId?: string | null; rowCount?: number | null; at?: string
  familyInheritance?: { familyId: string; representativeTestId: string } | null
}
export type Capability = {
  id: string; revision: number; draft: CapabilityDraft; selected: boolean
  state: string; compatibility: string; test: CapabilityTest | null
  compatibilityCode?: string
}
export type AdministrationHistory = {
  sequence: number; at: string; actor: string; action: string; capabilityId: string | null
  reference: string; capabilityName?: string; result?: string; packageVersion?: string; capabilityRevision?: number
}
export type Publication = { version: string; packageHash: string; approvedBy: string; at?: string }
export type RecordedFamily = { id: string; name: string; state: string; memberIds: string[] }
export type AdministrationState = {
  revision: number; setup: SetupConnection | null; snapshot?: DiscoverySnapshot | null
  analysis: AnalysisEvidence | null; capabilities: Capability[]; history: AdministrationHistory[]
  publications: Publication[]; activeVersion: string
  familyCatalog?: { families: RecordedFamily[] } | null
}

