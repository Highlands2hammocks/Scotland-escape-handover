import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Register the service worker with autoUpdate behaviour. When a new build is
// deployed: the SW detects the change, skipWaiting installs it, then we reload
// once on next launch so the home-screen icon picks up the new bundle.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    // Re-check the SW every 60 s while the app is open so updates land mid-session too
    setInterval(() => reg.update().catch(() => {}), 60 * 1000)
  },
  onNeedRefresh() {
    // autoUpdate skipWaiting already activated the new SW — reload to get its bundle
    window.location.reload()
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
