type Name = 'database' | 'analysis' | 'questions' | 'history' | 'plus' | 'send' | 'search' | 'chevron' | 'check' | 'lock' | 'spark' | 'arrow' | 'users' | 'settings'
const paths: Record<Name, string> = {
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m6 10v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  database: 'M20 6c0 2-3.6 3-8 3S4 8 4 6s3.6-3 8-3 8 1 8 3ZM4 6v6c0 2 3.6 3 8 3s8-1 8-3V6M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6',
  analysis: 'M4 20h16M7 16V9m5 7V4m5 12v-5',
  questions: 'M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0ZM7 10h8m-8 4h5',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
  plus: 'M12 5v14M5 12h14', send: 'm4 4 17 8-17 8 4-8-4-8Zm4 8h13',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5',
  chevron: 'm8 5 7 7-7 7', check: 'm5 12 4 4 10-10',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
}
export default function ConsoleIcon({ name, size = 20 }: { name: Name; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

