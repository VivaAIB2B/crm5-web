import type { ChatResponse } from './types'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080'

export async function askCrm(message: string): Promise<ChatResponse> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, maxSemanticObjects: 8 }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }

  return response.json() as Promise<ChatResponse>
}

