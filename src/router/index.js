// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'
import { legacyRedirect } from '@/utils/nav'

const LEGACY_PATHS = ['dashboard', 'positions', 'netvalue', 'trend', 'trends', 'fund']

const legacyRoutes = LEGACY_PATHS.map(p => ({
  path: `/${p}`,
  redirect: () => legacyRedirect(`/${p}`)
}))

const routes = [
  { path: '/', redirect: '/asset/overview' },
  {
    path: '/',
    component: () => import('@/components/common/MainLayout.vue'),
    children: [
      // ===== 资产（my-assets）=====
      {
        path: 'asset/overview',
        name: 'asset-overview',
        component: () => import('@/pages/asset/AssetOverviewPage.vue'),
        meta: { title: '概览' }
      },
      {
        path: 'asset/ledger',
        name: 'asset-ledger',
        component: () => import('@/pages/asset/AssetLedgerPage.vue'),
        meta: { title: '账本' }
      },
      {
        path: 'asset/stats',
        name: 'asset-stats',
        component: () => import('@/pages/asset/AssetStatsPage.vue'),
        meta: { title: '统计' }
      },
      {
        path: 'asset/poker',
        name: 'asset-poker',
        component: () => import('@/pages/asset/AssetPokerPage.vue'),
        meta: { title: '德州' }
      },
      // ===== 股票（Solo 版）=====
      {
        path: 'stock/holdings',
        name: 'stock-holdings',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: '持仓' }
      },
      {
        path: 'stock/positions',
        name: 'stock-positions',
        component: () => import('@/pages/PositionsPage.vue'),
        meta: { title: '仓位' }
      },
      {
        path: 'stock/netvalue',
        name: 'stock-netvalue',
        component: () => import('@/pages/NetValuePage.vue'),
        meta: { title: '净值' }
      },
      {
        path: 'stock/trends',
        name: 'stock-trends',
        component: () => import('@/pages/TrendPage.vue'),
        meta: { title: '趋势' }
      },
      {
        path: 'stock/capital',
        name: 'stock-capital',
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
  ...legacyRoutes,
  { path: '/:pathMatch(.*)*', redirect: '/asset/overview' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
