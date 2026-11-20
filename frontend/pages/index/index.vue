<template>
  <view class="page" :class="{ 'no-anim': noAnim }">
    <view class="hero">
      <view class="row between">
        <view>
          <text class="hello">{{ t('你好，{name} 👋', { name: user.nickname || user.username || t('食客') }) }}</text>
          <text class="muted">{{ t('今天也要好好吃饭') }}</text>
        </view>
        <view class="avatar">{{ avatarChar }}</view>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <view class="stat">
          <text class="stat-num">{{ stats.mealCount }}</text>
          <text class="muted">{{ t('已确认用餐') }}</text>
        </view>
        <view class="stat">
          <text class="stat-num">{{ stats.unlocked }}/{{ enc.total }}</text>
          <text class="muted">{{ t('图鉴解锁') }}</text>
        </view>
        <view class="stat">
          <text class="stat-num">{{ stats.badgeCount }}/{{ stats.badgeTotal }}</text>
          <text class="muted">{{ t('获得勋章') }}</text>
        </view>
      </view>
      <view class="progress">
        <view class="progress-bar" :style="{ width: progressPct + '%' }"></view>
      </view>
      <text class="muted">{{ t('图鉴进度 {n}%', { n: progressPct }) }}</text>
    </view>

    <view class="grid">
      <view class="action" @tap="go('/pages/plan/plan')" aria-role="button">
        <text class="action-icon">🧮</text>
        <text class="action-title">{{ t('餐前推荐') }}</text>
        <text class="muted">{{ t('按预算/热量搭一桌') }}</text>
      </view>
      <view class="action" @tap="switchTab('/pages/world/world')" aria-role="button">
        <text class="action-icon">🌏</text>
        <text class="action-title">{{ t('世界菜单') }}</text>
        <text class="muted">{{ t('七地区 1525 道比价') }}</text>
      </view>
      <view class="action" @tap="go('/pages/record/record')" aria-role="button">
        <text class="action-icon">📷</text>
        <text class="action-title">{{ t('餐后记录') }}</text>
        <text class="muted">{{ t('拍照/OCR/手动记账') }}</text>
      </view>
      <view class="action" @tap="go('/pages/history/history')" aria-role="button">
        <text class="action-icon">📜</text>
        <text class="action-title">{{ t('用餐历史') }}</text>
        <text class="muted">{{ t('回看评级与花费') }}</text>
      </view>
      <view class="action" @tap="switchTab('/pages/encyclopedia/encyclopedia')" aria-role="button">
        <text class="action-icon">🏅</text>
        <text class="action-title">{{ t('图鉴勋章') }}</text>
        <text class="muted">{{ t('解锁更多寿司') }}</text>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">{{ t('最近用餐') }}</text>
        <text class="muted" @tap="go('/pages/history/history')" aria-role="button">{{ t('全部 ›') }}</text>
      </view>
      <view v-if="!meals.length" class="empty">{{ t('还没有记录，去记一顿吧') }}</view>
      <view class="anim-list">
        <view v-for="m in meals" :key="m.id" class="meal-row" @tap="go('/pages/mealDetail/mealDetail?id=' + m.id)" aria-role="button">
          <view class="flex1">
            <text class="meal-date">{{ fmtDate(m.eaten_at) }}</text>
            <text class="muted"> {{ t('{n} 道菜 · 实付 ¥{x}', { n: m.item_count, x: m.actual_paid == null ? '—' : m.actual_paid }) }}</text>
          </view>
          <text v-if="m.status === 'void'" class="pill void">{{ t('已作废') }}</text>
          <!-- 审计 B4：关掉评级后不能退回「草稿」—— 已确认就是已确认，只是不给档位 -->
          <view v-else-if="m.status === 'confirmed' && m.tier && showTier" class="pill" :style="{ background: tierBg(m.tier), color: tierFg(m.tier) }">
            {{ t('{t} · {n} 分', { t: tierLabel(m.tier), n: m.score }) }}
          </view>
          <text v-else-if="m.status === 'confirmed'" class="muted">{{ t('已确认') }}</text>
          <text v-else class="muted">{{ t('草稿') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
// 审计 B7：动效开关。系统「减弱动态效果」由 CSS 的 prefers-reduced-motion 兜住，
// 这里再给一个应用内开关 —— 有些人不改系统设置，但确实会被闪动影响。
const noAnim = ref(false)
function syncNoAnim() {
  try {
    noAnim.value = uni.getStorageSync('noAnim') === true
  } catch {
    noAnim.value = false
  }
}
syncNoAnim()

import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { fmtDate } from '../../common/util.js'
import { showTier, syncShowTier } from '../../common/uiPrefs.js'
import { t, useLocale } from '../../common/i18n.js'

// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('一贯点餐测评')

syncShowTier()

const user = ref({})
const stats = ref({ mealCount: 0, unlocked: 0, badgeCount: 0, badgeTotal: 0 })
const enc = ref({ total: 0, unlocked: 0 })
const meals = ref([])

const progressPct = computed(() => {
  const base = enc.value.total || 1
  return Math.round((enc.value.unlocked / base) * 100)
})

// 头像取昵称首字；英文昵称取首字母大写，中文取第一个字
const avatarChar = computed(() => {
  const n = user.value.nickname || user.value.username || ''
  return n ? n.trim()[0].toUpperCase() : 'S'
})

function tierLabel(k) { return t(TIER_LABEL[k] || k) }
function tierBg(t) { return (TIER_COLOR[t] || '#6b7280') + '1a' }
function tierFg(t) { return TIER_COLOR[t] || '#6b7280' }

function go(url) { uni.navigateTo({ url }) }
function switchTab(url) { uni.switchTab({ url }) }

async function load() {
  try {
    const p = await api.get('/api/user/profile')
    user.value = p.user || {}
    stats.value = { ...stats.value, ...p.stats }
    uni.setStorageSync('user', p.user)
    const [b, e, h] = await Promise.all([
      api.get('/api/badges'),
      api.get('/api/encyclopedia'),
      api.get('/api/meals'),
    ])
    stats.value.badgeCount = b.ownedCount
    stats.value.badgeTotal = b.total
    enc.value = e.stats
    meals.value = (h.meals || []).slice(0, 3)
  } catch (e) {
    /* 未登录由 api 统一跳转 */
  }
}

onShow(() => load())
</script>

<style scoped>
.hero { padding: 20rpx 8rpx 28rpx; }
.hello { display: block; font-size: 38rpx; font-weight: 700; }
.avatar {
  width: 88rpx; height: 88rpx; border-radius: 50%;
  background: #c0392f; color: #fff; font-size: 36rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.stat { flex: 1; text-align: center; }
.stat-num { display: block; font-size: 36rpx; font-weight: 700; color: #1f2329; }
.progress { height: 14rpx; background: #f1f2f5; border-radius: 999rpx; margin: 22rpx 0 12rpx; overflow: hidden; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #c47f00, #c0392f); border-radius: 999rpx; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 20rpx; }
.action {
  background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20,24,40,0.04);
}
.action-icon { display: block; font-size: 44rpx; margin-bottom: 12rpx; }
.action-title { display: block; font-size: 30rpx; font-weight: 600; margin-bottom: 6rpx; }
.meal-row { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.meal-row:last-child { border-bottom: none; }
.meal-date { font-size: 26rpx; color: #1f2329; }
.void { background: #fdeaea; color: #c0392f; }
</style>
