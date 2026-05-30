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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/003生词训练本/sw.js')
  })
}
