<template>
  <view class="page">
    <view class="card" v-if="filtered !== meals.length || meals.length">
      <view class="row between">
        <text class="muted">共 {{ meals.length }} 条记录</text>
        <text v-if="voidCount" class="clear-link" @tap="showVoid = !showVoid">
          {{ showVoid ? '隐藏作废' : '显示作废（' + voidCount + '）' }}
        </text>
      </view>
    </view>

    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="!list.length" class="empty">还没有用餐记录，去记一顿吧</view>

    <view v-for="m in list" :key="m.id" :class="['card', m.status === 'void' ? 'is-void' : '']" @tap="go(m.id)">
      <view class="row between">
        <text class="date">{{ fmtDate(m.eaten_at) }}</text>
        <!-- 作废优先：作废单不计入评级，即使后端仍返回 tier/score 也不显示档位 -->
        <text v-if="m.status === 'void'" class="pill void">已作废</text>
        <view
          v-else-if="m.status === 'confirmed' && m.tier"
          class="pill"
          :style="{ background: tierBg(m.tier), color: tierFg(m.tier) }"
        >{{ tierLabel(m.tier) }} · {{ m.score }}分</view>
        <text v-else class="pill draft">草稿</text>
      </view>
      <view class="muted" style="margin-top: 10rpx">
        {{ m.item_count }} 道菜<text v-if="m.actual_paid != null"> · 实付 ¥{{ fmtMoney(m.actual_paid) }}</text>
        <text v-if="m.rating"> · 自评 {{ m.rating }} 星</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { errMsg, fmtDate, fmtMoney } from '../../common/util.js'

const meals = ref([])
const loading = ref(false)
const showVoid = ref(false)

const voidCount = computed(() => meals.value.filter((m) => m.status === 'void').length)
const filtered = computed(() => (showVoid.value ? meals.value : meals.value.filter((m) => m.status !== 'void')))
// 作废单默认折叠；展开时排到最后，避免与正常记录混排
const list = computed(() => {
  const arr = filtered.value.slice()
  if (showVoid.value) arr.sort((a, b) => (a.status === 'void' ? 1 : 0) - (b.status === 'void' ? 1 : 0))
  return arr
})

function tierBg(t) { return (TIER_COLOR[t] || '#8a8f99') + '1a' }
function tierFg(t) { return TIER_COLOR[t] || '#8a8f99' }
function tierLabel(t) { return TIER_LABEL[t] || t }
function go(id) { uni.navigateTo({ url: '/pages/mealDetail/mealDetail?id=' + id }) }

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/meals')
    meals.value = data.meals || []
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  } finally {
    loading.value = false
  }
}

onShow(() => load())
</script>

<style scoped>
.date { font-size: 28rpx; font-weight: 600; }
.draft { background: #f1f2f5; color: #8a8f99; }
.void { background: #fdeaea; color: #e64a45; }
.is-void { opacity: 0.62; }
.clear-link { color: #3b82f6; font-size: 24rpx; }
</style>
