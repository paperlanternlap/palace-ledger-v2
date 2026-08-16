import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/base.css'
import './styles/auth.css'
import './styles/layout.css'
import './styles/characters.css'
import './styles/inventory.css'
import './styles/item-requests.css'
import './styles/followers.css'
import './styles/rp-queue.css'
import './styles/overview.css'
import './styles/overlays.css'
import './styles/responsive.css'
import App from './App.jsx'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const recoveryKey = 'palace-ledger-chunk-recovery'
  if (sessionStorage.getItem(recoveryKey)) return
  sessionStorage.setItem(recoveryKey, '1')
  window.location.reload()
})
window.setTimeout(() => sessionStorage.removeItem('palace-ledger-chunk-recovery'), 10_000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
