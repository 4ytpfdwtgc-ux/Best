import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker, requestPersistence } from './lib/offline'

import './styles/theme.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/layout.css'
import './styles/reminders.css'
import './styles/calendar.css'
import './styles/notes.css'
import './styles/home.css'
import './styles/phone.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The app has to start from the device when there is no signal, and its
// storage has to survive a week of not being opened.
registerServiceWorker()
void requestPersistence()
