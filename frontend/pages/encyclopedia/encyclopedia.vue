<template>
  <view class="page">
    <view class="tabs">
      <view :class="['tab', tab === 'dish' ? 'active' : '']" @tap="tab = 'dish'">
        图鉴 {{ encStats.unlocked }}/{{ encStats.total }}
      </view>
      <view :class="['tab', tab === 'badge' ? 'active' : '']" @tap="tab = 'badge'">
        勋章 {{ badgeStats.owned }}/{{ badgeStats.total }}
      </view>
    </view>

    <view v-if="tab === 'dish'">
      <view v-if="!dishes.length" class="empty">暂无菜品</view>
      <view class="grid">
        <view v-for="d in dishes" :key="d.id" :class="['dish-cell', d.unlocked ? 'unlocked' : 'locked']">
          <text class="dish-emoji">{{ d.unlocked ? '🍣' : '🔒' }}</text>
          <text class="dish-name">{{ d.name }}</text>
          <text v-if="d.unlocked" class="muted">{{ d.eat_count }} 次 · {{ d.portion_count }} 份</text>
          <text v-else class="muted">未解锁</text>
        </view>
      </view>
    </view>

    <view v-else>
      <view v-if="!badges.length" class="empty">暂无勋章</view>
      <view v-for="b in badges" :key="b.id" class="card badge-row">
        <text class="badge-icon">{{ b.owned ? '🏅' : '🔒' }}</text>
        <view class="flex1">
          <text class="badge-name">{{ b.name }}</text>
          <text class="muted badge-desc">{{ b.description }}</text>
          <view class="progress">
            <view class="progress-bar" :style="{ width: progressPct(b) + '%' }"></view>
          </view>
          <text class="muted">{{ Math.min(b.current, b.required_count) }}/{{ b.required_count }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'

const tab = ref('dish')
const dishes = ref([])
const encStats = ref({ total: 0, unlocked: 0 })
const badges = ref([])
const badgeStats = ref({ owned: 0, total: 0 })

function progressPct(b) {
  const t = b.required_count || 1
  return Math.min(100, Math.round((b.current / t) * 100))
}

async function load() {
  try {
    const [e, b] = await Promise.all([api.get('/api/encyclopedia'), api.get('/api/badges')])
    dishes.value = e.dishes || []
    encStats.value = e.stats
    badges.value = b.badges || []
    badgeStats.value = { owned: b.ownedCount, total: b.total }
  } catch (err) {
    uni.showToast({ title: err.message, icon: 'none' })
  }
}

onShow(() => load())
</script>

<style scoped>
.tabs { display: flex; background: #f1f2f5; border-radius: 16rpx; padding: 6rpx; margin-bottom: 24rpx; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; border-radius: 12rpx; font-size: 28rpx; color: #5b6470; }
.tab.active { background: #fff; color: #e64a45; font-weight: 600; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16rpx; }
.dish-cell {
  background: #fff; border-radius: 18rpx; padding: 20rpx 14rpx; text-align: center;
  box-shadow: 0 2rpx 10rpx rgba(20, 24, 40, 0.04); display: flex; flex-direction: column; align-items: center;
}
.dish-cell.locked { opacity: 0.55; }
.dish-emoji { font-size: 40rpx; margin-bottom: 8rpx; }
.dish-name { font-size: 24rpx; font-weight: 600; margin-bottom: 6rpx; }
.badge-row { display: flex; align-items: center; }
.badge-icon { font-size: 52rpx; margin-right: 20rpx; }
.badge-name { display: block; font-size: 28rpx; font-weight: 600; }
.badge-desc { display: block; margin: 6rpx 0 12rpx; line-height: 1.5; }
.progress { height: 10rpx; background: #f1f2f5; border-radius: 999rpx; overflow: hidden; margin-bottom: 8rpx; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #f59f00, #e64a45); }
</style>
