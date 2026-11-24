// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/',
    component: () => import('@/components/common/MainLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: '持仓' }
      },
      {
        path: 'positions',
        name: 'positions',
        component: () => import('@/pages/PositionsPage.vue'),
        meta: { title: '仓位' }
      },
      {
        path: 'trends',
        name: 'trends',
        component: () => import('@/pages/TrendsPage.vue'),
        meta: { title: '盈亏榜单' }
      },
      {
        path: 'netvalue',
        name: 'netvalue',
        component: () => import('@/pages/NetValuePage.vue'),
        meta: { title: '净值走势' }
      },
      {
        path: 'trend',
        name: 'trend',
        component: () => import('@/pages/TrendPage.vue'),
        meta: { title: '趋势' }
      },
      {
        path: 'fund',
        name: 'fund',
        component: () => import('@/pages/FundPage.vue'),
        meta: { title: '资本' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue'),
        meta: { title: '设置' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
