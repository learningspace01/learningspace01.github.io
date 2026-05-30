import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '@/views/HomePage.vue'

const VocabMaster = () => import('@/views/vocab/VocabMaster.vue')
const ClassFlowMaster = () => import('@/views/classflow/ClassFlowMaster.vue')

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/vocab',
      name: 'vocab',
      component: VocabMaster,
    },
    {
      path: '/classflow',
      name: 'classflow',
      component: ClassFlowMaster,
    },
  ],
})

export default router
