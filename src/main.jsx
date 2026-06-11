import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Register the service worker with autoUpdate behaviour. When a new build is
// deployed: the SW detects the change, skipWaiting installs it, then we reload
// so the home-screen icon picks up the new bundle.
//
// iOS Safari throttles service-worker updates aggressively for installed PWAs,
// so we also force an update check whenever the PWA becomes visible — that's
// the moment a team member taps the icon, which is exactly when they want the
// latest code.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const checkForUpdate = () => reg.update().catch(() => {})
    // Re-check every 30 s while the app is open so updates land mid-session
    setInterval(checkForUpdate, 30 * 1000)
    // And every time the PWA is foregrounded (catches the icon-tap case on iPad)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
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
