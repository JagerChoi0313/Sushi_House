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
      <view class="row wrap filters">
        <view
          v-for="f in dishFilters"
          :key="f.value"
          :class="['chip', dishFilter === f.value ? 'active' : '']"
          @tap="setDishFilter(f.value)"
        >{{ f.label }}</view>
      </view>

      <view v-if="!dishes.length" class="empty">暂无菜品</view>
      <view v-else-if="!shownDishes.length" class="empty">这个筛选下还没有菜品</view>
      <view v-else class="grid">
        <view v-for="d in shownDishes" :key="d.id" :class="['dish-cell', d.unlocked ? 'unlocked anim-pop' : 'locked']">
          <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" :class="['dish-img', d.unlocked ? '' : 'dim']" lazy-load />
          <text v-else class="dish-emoji">{{ d.unlocked ? '🍣' : '🔒' }}</text>
          <text class="dish-name">{{ d.name }}</text>
          <text v-if="d.unlocked" class="muted">{{ d.eat_count }} 次 · {{ d.portion_count }} 份</text>
          <text v-else class="muted">未解锁</text>
        </view>
      </view>

      <view v-if="shownDishes.length < filteredDishes.length" class="load-more">
        <text class="more-link" @tap="showMore">加载更多（{{ shownDishes.length }}/{{ filteredDishes.length }}）</text>
      </view>
    </view>

    <view v-else>
      <view class="row wrap filters">
        <view
          v-for="f in badgeFilters"
          :key="f.value"
          :class="['chip', badgeFilter === f.value ? 'active' : '']"
          @tap="badgeFilter = f.value"
        >{{ f.label }}</view>
      </view>

      <view v-if="!badges.length" class="empty">暂无勋章</view>
      <view v-else-if="!shownBadges.length" class="empty">这个筛选下还没有勋章</view>
      <view v-for="b in shownBadges" :key="b.id" class="card badge-row">
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

      <view v-if="shownBadges.length < filteredBadges.length" class="load-more">
        <text class="more-link" @tap="showMoreBadge">加载更多（{{ shownBadges.length }}/{{ filteredBadges.length }}）</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { BASE_URL } from '../../common/config.js'
import { errMsg } from '../../common/util.js'

const STEP = 60

const tab = ref('dish')
const dishes = ref([])
const encStats = ref({ total: 0, unlocked: 0 })
const badges = ref([])
const badgeStats = ref({ owned: 0, total: 0 })

const dishFilter = ref('all')
const dishFilters = [
  { label: '全部', value: 'all' },
  { label: '已解锁', value: 'unlocked' },
  { label: '未解锁', value: 'locked' },
]
const badgeFilter = ref('all')
const badgeFilters = [
  { label: '全部', value: 'all' },
  { label: '已获得', value: 'owned' },
  { label: '未获得', value: 'locked' },
]

const dishLimit = ref(STEP)
const badgeLimit = ref(STEP)

// 分母与列表口径已对齐（2026-11-13）：后端按菜名去重后，列表长度 === stats.total。
// 去重原因：库里 78 组同名重复（156 道，只有 category_id 不同），不去重会出现
// 「一格解锁、旁边一格一模一样的还锁着」。进度按菜名合并 —— 吃过任意一份就算解锁。
const filteredDishes = computed(() => {
  if (dishFilter.value === 'unlocked') return dishes.value.filter((d) => d.unlocked)
  if (dishFilter.value === 'locked') return dishes.value.filter((d) => !d.unlocked)
  return dishes.value
})
const shownDishes = computed(() => filteredDishes.value.slice(0, dishLimit.value))

const filteredBadges = computed(() => {
  if (badgeFilter.value === 'owned') return badges.value.filter((b) => b.owned)
  if (badgeFilter.value === 'locked') return badges.value.filter((b) => !b.owned)
  return badges.value
})
const shownBadges = computed(() => filteredBadges.value.slice(0, badgeLimit.value))

function setDishFilter(v) {
  dishFilter.value = v
  dishLimit.value = STEP
}
function showMore() {
  dishLimit.value += STEP
}
function showMoreBadge() {
  badgeLimit.value += STEP
}

function progressPct(b) {
  const t = b.required_count || 1
  return Math.min(100, Math.round(((Number(b.current) || 0) / t) * 100))
}

async function load() {
  try {
    const [e, b] = await Promise.all([api.get('/api/encyclopedia'), api.get('/api/badges')])
    dishes.value = e.dishes || []
    encStats.value = e.stats || encStats.value
    badges.value = b.badges || []
    badgeStats.value = { owned: b.ownedCount, total: b.total }
  } catch (err) {
    uni.showToast({ title: errMsg(err), icon: 'none' })
  }
}

onShow(() => load())

onReachBottom(() => {
  if (tab.value === 'dish' && shownDishes.value.length < filteredDishes.value.length) showMore()
  if (tab.value === 'badge' && shownBadges.value.length < filteredBadges.value.length) showMoreBadge()
})
</script>

<style scoped>
.tabs { display: flex; background: #f1f2f5; border-radius: 16rpx; padding: 6rpx; margin-bottom: 24rpx; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; border-radius: 12rpx; font-size: 28rpx; color: #5b6470; }
.tab.active { background: #fff; color: #e64a45; font-weight: 600; }
.filters { margin-bottom: 20rpx; }
.chip {
  display: inline-block; padding: 10rpx 24rpx; margin: 0 12rpx 8rpx 0;
  border-radius: 999rpx; background: #fff; color: #5b6470; font-size: 24rpx;
}
.chip.active { background: #e64a45; color: #fff; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16rpx; }
.dish-cell {
  background: #fff; border-radius: 18rpx; padding: 20rpx 14rpx; text-align: center;
  box-shadow: 0 2rpx 10rpx rgba(20, 24, 40, 0.04); display: flex; flex-direction: column; align-items: center;
}
.dish-cell.locked { opacity: 0.55; }
.dish-img { width: 140rpx; height: 140rpx; border-radius: 14rpx; margin-bottom: 10rpx; background: #f1f2f5; }
.dish-img.dim { filter: grayscale(1); opacity: 0.7; }
.dish-emoji { font-size: 40rpx; margin-bottom: 8rpx; }
.dish-name { font-size: 24rpx; font-weight: 600; margin-bottom: 6rpx; }
.badge-row { display: flex; align-items: center; }
.badge-icon { font-size: 52rpx; margin-right: 20rpx; }
.badge-name { display: block; font-size: 28rpx; font-weight: 600; }
.badge-desc { display: block; margin: 6rpx 0 12rpx; line-height: 1.5; }
.progress { height: 10rpx; background: #f1f2f5; border-radius: 999rpx; overflow: hidden; margin-bottom: 8rpx; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #f59f00, #e64a45); }
.load-more { text-align: center; padding: 16rpx 0 40rpx; }
.more-link { color: #3b82f6; font-size: 26rpx; }
</style>
