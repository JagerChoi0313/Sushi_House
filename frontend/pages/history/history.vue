<template>
  <view class="page">
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="!meals.length" class="empty">还没有用餐记录，去记一顿吧</view>
    <view v-for="m in meals" :key="m.id" class="card" @tap="go(m.id)">
      <view class="row between">
        <text class="date">{{ fmtDate(m.eaten_at) }}</text>
        <view v-if="m.tier" class="pill" :style="{ background: tierBg(m.tier), color: tierFg(m.tier) }">
          {{ TIER_LABEL[m.tier] }} · {{ m.score }}分
        </view>
        <text v-else class="pill draft">{{ m.status === 'void' ? '已作废' : '草稿' }}</text>
      </view>
      <view class="muted" style="margin-top: 10rpx">
        {{ m.item_count }} 道菜<text v-if="m.actual_paid != null"> · 实付 ¥{{ m.actual_paid }}</text>
        <text v-if="m.rating"> · 自评 {{ m.rating }} 星</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { fmtDate } from '../../common/util.js'

const meals = ref([])
const loading = ref(false)

function tierBg(t) { return (TIER_COLOR[t] || '#8a8f99') + '1a' }
function tierFg(t) { return TIER_COLOR[t] || '#8a8f99' }
function go(id) { uni.navigateTo({ url: '/pages/mealDetail/mealDetail?id=' + id }) }

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/meals')
    meals.value = data.meals || []
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    loading.value = false
  }
}

onShow(() => load())
</script>

<style scoped>
.date { font-size: 28rpx; font-weight: 600; }
.draft { background: #f1f2f5; color: #8a8f99; }
</style>
