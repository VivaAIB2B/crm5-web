export type RelevantSemanticObject = {
  id: string
  semanticName: string
  physicalObject: string
  objectType: string
  businessDomain: string
  confidence: number
  retrievalScore: number
  description: string
}

export type ChatResponse = {
  answer: string
  explain: {
    mode: string
    tokens: string[]
    relevantObjects: RelevantSemanticObject[]
    elapsedMs: number
    nextStage: string
  }
}

