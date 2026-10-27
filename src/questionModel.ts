import type { Capability, RecordedFamily } from './adminTypes'

export const stages = ['Domanda', 'Requisiti', 'Preparazione', 'Collaudo', 'Pubblicazione'] as const
export type QuestionGroup = 'Bozze' | 'In corso' | 'Pubblicate'
export type PipelineStep = { label: string; detail: string; state: 'available' | 'current' | 'waiting' | 'attention' | 'in-progress' }
export type ChatMessage = { role: 'user' | 'assistant'; text: string }

export function questionTitle(capability: Capability) {
  return capability.draft.exampleQuestion.trim() || capability.draft.name
}
export function isSchemaSuggestion(c: Capability) {
  return c.draft.origin === 'schema' && c.draft.intent == null && !c.selected && c.revision === 1
}
export function recordedGroup(c: Capability): QuestionGroup {
  if (c.state === 'published') return 'Pubblicate'
  return c.selected || ['verified', 'validated', 'suspended'].includes(c.state) ? 'In corso' : 'Bozze'
}
export function recordedStatus(c: Capability) {
  if (c.state === 'suspended') return 'Sospesa'
  if (c.state === 'rejected') return 'Scartata'
  if (c.test?.revision !== undefined && c.test.revision !== c.revision) return 'Verifica da aggiornare'
  if (c.test?.result === 'FAIL') return 'Da rivedere'
  return recordedGroup(c) === 'Pubblicate' ? 'Pubblicata' : recordedGroup(c) === 'In corso' ? 'In corso' : 'Bozza'
}
export function recordedPipeline(c: Capability): { current: number; steps: PipelineStep[] } {
  const currentTest = c.test && c.test.revision === c.revision
  const current = c.state === 'published' ? 4 : currentTest && c.test?.result === 'PASS' ? 4 : c.draft.intent != null ? 3 : 1
  const details = [
    'Domanda registrata',
    c.draft.ambiguities.trim() ? 'Punti da chiarire' : 'Da confermare in chat',
    c.draft.intent != null ? 'Configurazione presente' : 'Da preparare',
    !c.test ? 'Da verificare' : !currentTest ? 'Prova non attribuibile a questa revisione' : c.test.result === 'FAIL' ? 'Verifica non superata'
      : c.test.code === 'CRM5_FAMILY_INHERITED' ? 'Verifica ereditata dalla famiglia' + (c.test.fixture ? ' · dati di esempio' : '') : c.test.fixture === true ? 'Prova su dati di esempio' : 'Prova registrata',
    c.state === 'published' ? 'Pubblicazione registrata' : 'Non pubblicata',
  ]
  return { current, steps: stages.map((label, i) => ({ label, detail: details[i], state:
    i === 3 && c.test && (!currentTest || c.test.result === 'FAIL') ? 'attention' : i === current ? 'current' :
      i === 0 || i === 2 && c.draft.intent != null || i === 3 && !!currentTest && c.test?.result === 'PASS' ? 'available' : 'waiting' })) }
}
export function recordedMessages(c: Capability, families: RecordedFamily[]): ChatMessage[] {
  const family = families.find(f => f.memberIds.includes(c.id))
  const context = c.state === 'published' ? 'Nel catalogo questa domanda risulta pubblicata.' : c.test?.result === 'FAIL'
    ? 'L’ultima verifica registrata non è stata superata.' : c.draft.intent != null
      ? 'Per questa domanda è già presente una configurazione nel catalogo.' : 'Questa domanda è ancora da configurare.'
  return [{ role: 'user', text: questionTitle(c) }, { role: 'assistant', text: context +
    (c.draft.description.trim() ? '\n\n' + c.draft.description : '') +
    (family ? '\n\nFamiglia registrata: ' + family.name + '.' : '') },
    { role: 'assistant', text: 'Puoi raccogliere i requisiti in una conversazione separata. I messaggi del catalogo sono un riepilogo dei dati disponibili, non una conversazione storica.' }]
}

