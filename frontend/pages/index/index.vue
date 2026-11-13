<template>
  <view class="page">
    <view class="hero">
      <view class="row between">
        <view>
          <text class="hello">你好，{{ user.nickname || user.username || '食客' }} 👋</text>
          <text class="muted">今天也要好好吃饭</text>
        </view>
        <view class="avatar">{{ (user.nickname || '食')[0] }}</view>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <view class="stat">
          <text class="stat-num">{{ stats.mealCount }}</text>
          <text class="muted">已确认用餐</text>
        </view>
        <view class="stat">
          <text class="stat-num">{{ stats.unlocked }}/{{ enc.total }}</text>
          <text class="muted">图鉴解锁</text>
        </view>
        <view class="stat">
          <text class="stat-num">{{ stats.badgeCount }}/{{ stats.badgeTotal }}</text>
          <text class="muted">获得勋章</text>
        </view>
      </view>
      <view class="progress">
        <view class="progress-bar" :style="{ width: progressPct + '%' }"></view>
      </view>
      <text class="muted">图鉴进度 {{ progressPct }}%</text>
    </view>

    <view class="grid">
      <view class="action" @tap="go('/pages/plan/plan')">
        <text class="action-icon">🧮</text>
        <text class="action-title">餐前推荐</text>
        <text class="muted">按预算/热量搭一桌</text>
      </view>
      <view class="action" @tap="switchTab('/pages/world/world')">
        <text class="action-icon">🌏</text>
        <text class="action-title">世界菜单</text>
        <text class="muted">七地区 1525 道比价</text>
      </view>
      <view class="action" @tap="go('/pages/record/record')">
        <text class="action-icon">📷</text>
        <text class="action-title">餐后记录</text>
        <text class="muted">拍照/OCR/手动记账</text>
      </view>
      <view class="action" @tap="go('/pages/history/history')">
        <text class="action-icon">📜</text>
        <text class="action-title">用餐历史</text>
        <text class="muted">回看评级与花费</text>
      </view>
      <view class="action" @tap="switchTab('/pages/encyclopedia/encyclopedia')">
        <text class="action-icon">🏅</text>
        <text class="action-title">图鉴勋章</text>
        <text class="muted">解锁更多寿司</text>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">最近用餐</text>
        <text class="muted" @tap="go('/pages/history/history')">全部 ›</text>
      </view>
      <view v-if="!meals.length" class="empty">还没有记录，去记一顿吧</view>
      <view class="anim-list">
        <view v-for="m in meals" :key="m.id" class="meal-row" @tap="go('/pages/mealDetail/mealDetail?id=' + m.id)">
          <view class="flex1">
            <text class="meal-date">{{ fmtDate(m.eaten_at) }}</text>
            <text class="muted"> {{ m.item_count }} 道菜 · 实付 ¥{{ m.actual_paid == null ? '—' : m.actual_paid }}</text>
          </view>
          <text v-if="m.status === 'void'" class="pill void">已作废</text>
          <view v-else-if="m.status === 'confirmed' && m.tier" class="pill" :style="{ background: tierBg(m.tier), color: tierFg(m.tier) }">
            {{ tierLabel(m.tier) }} · {{ m.score }}分
          </view>
          <text v-else class="muted">草稿</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { fmtDate } from '../../common/util.js'

const user = ref({})
const stats = ref({ mealCount: 0, unlocked: 0, badgeCount: 0, badgeTotal: 0 })
const enc = ref({ total: 0, unlocked: 0 })
const meals = ref([])

const progressPct = computed(() => {
  const t = enc.value.total || 1
  return Math.round((enc.value.unlocked / t) * 100)
})

function tierLabel(t) { return TIER_LABEL[t] || t }
function tierBg(t) { return (TIER_COLOR[t] || '#8a8f99') + '1a' }
function tierFg(t) { return TIER_COLOR[t] || '#8a8f99' }

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
  background: #e64a45; color: #fff; font-size: 36rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.stat { flex: 1; text-align: center; }
.stat-num { display: block; font-size: 36rpx; font-weight: 700; color: #1f2329; }
.progress { height: 14rpx; background: #f1f2f5; border-radius: 999rpx; margin: 22rpx 0 12rpx; overflow: hidden; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #f59f00, #e64a45); border-radius: 999rpx; }
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
.void { background: #fdeaea; color: #e64a45; }
</style>
