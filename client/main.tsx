import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ClientAccess from '../src/ClientAccess'

createRoot(document.getElementById('root')!).render(
  <StrictMode><ClientAccess /></StrictMode>,
)

