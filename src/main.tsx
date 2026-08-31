import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

import './styles/theme.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/layout.css'
import './styles/reminders.css'
import './styles/calendar.css'
import './styles/notes.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
