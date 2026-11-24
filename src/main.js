import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import './assets/styles/global.css'

function bootstrap() {
  const app = createApp(App)
  // Vue 渲染期错误也送到诊断层
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue error]', err, info)
    if (window.__errOverlay) window.__errOverlay('VUE', err && err.message, (err && err.stack || '') + '\n[info] ' + (info || ''))
  }
  app.use(createPinia())
  app.use(router)
  app.use(Vant)
  app.mount('#app')
}

bootstrap()
