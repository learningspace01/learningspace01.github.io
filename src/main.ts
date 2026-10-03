import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import './styles/variables.css'
import './styles/base.css'
import './styles/glassmorphism.css'
import './styles/animations.css'
import './styles/dark-mode.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// The service worker caches the app shell and hashed assets; registering it in
// dev would cache Vite's unbundled modules and fight HMR, so production only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const scope = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${scope}sw.js`, { scope }).catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}
