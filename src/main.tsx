import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AdminAccess'
import ClientAccess from './ClientAccess'
import './admin.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.pathname.startsWith('/client') ? <ClientAccess /> : <App />}
  </StrictMode>,
)

