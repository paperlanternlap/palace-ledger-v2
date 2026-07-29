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
import './styles/overlays.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
