<template>
  <view class="page" v-if="meal">
    <view class="card">
      <view class="row between">
        <text class="title">{{ fmtDate(meal.eaten_at) }}</text>
        <text :class="['pill', 'st-' + meal.status]">{{ statusLabel }}</text>
      </view>
      <view class="muted" style="margin-top: 10rpx">
        实付 ¥{{ meal.actual_paid == null ? '—' : meal.actual_paid }} · 自评 {{ stars(meal.rating) }}
      </view>
      <text v-if="meal.comment" style="display: block; margin-top: 14rpx">{{ meal.comment }}</text>
    </view>

    <view class="card">
      <text class="section-title">菜品明细</text>
      <view v-for="it in meal.items" :key="it.id" class="item-row">
        <text class="flex1">{{ it.dish_name }}</text>
        <text class="muted" style="margin: 0 16rpx">x{{ it.quantity }}</text>
        <text>¥{{ it.unit_price }}</text>
        <text class="muted" style="margin-left: 16rpx">{{ it.unit_calories != null ? it.unit_calories + ' kcal' : '—' }}</text>
      </view>
    </view>

    <view v-if="meal.evaluation" class="card">
      <text class="section-title">系统评级</text>
      <view class="row between">
        <text class="tier" :style="{ color: tierColor(meal.evaluation.tier) }">{{ TIER_LABEL[meal.evaluation.tier] }}</text>
        <text class="muted">{{ meal.evaluation.score }} 分</text>
      </view>
      <view class="basis">
        <text class="basis-line">预算：{{ meal.evaluation.basis.budgetMet == null ? '未设置计划' : meal.evaluation.basis.budgetMet ? '达成 ✓' : '超支 ' + meal.evaluation.basis.budgetDelta + ' 元' }}</text>
        <text class="basis-line">热量：{{ meal.evaluation.basis.calorieMet == null ? '未设置上限' : meal.evaluation.basis.calorieMet ? '达成 ✓' : '超出' }}</text>
        <text class="basis-line">口味匹配：{{ Math.round((meal.evaluation.basis.prefRatio || 0) * 100) }}%</text>
      </view>
    </view>

    <view v-if="meal.uploads && meal.uploads.length" class="card">
      <text class="section-title">照片</text>
      <view class="row wrap">
        <image
          v-for="u in meal.uploads"
          :key="u.id"
          :src="BASE_URL + u.file_path"
          mode="aspectFill"
          class="thumb"
          @tap="preview"
        />
      </view>
    </view>

    <view v-if="meal.status === 'draft'" class="row" style="margin-top: 20rpx">
      <view class="btn btn-primary" style="flex: 1; margin-right: 16rpx" @tap="confirmIt">确认用餐</view>
      <view class="btn btn-ghost" style="flex: 1" @tap="voidIt">作废</view>
    </view>
  </view>
  <view v-else class="empty">加载中…</view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { BASE_URL, TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { fmtDate, stars } from '../../common/util.js'

const meal = ref(null)
const mealId = ref(null)

const statusLabel = computed(() => {
  const s = meal.value && meal.value.status
  return s === 'draft' ? '草稿' : s === 'confirmed' ? '已确认' : s === 'void' ? '已作废' : s
})

function tierColor(t) { return TIER_COLOR[t] || '#8a8f99' }

async function load() {
  try {
    const data = await api.get('/api/meals/' + mealId.value)
    meal.value = data
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function confirmIt() {
  try {
    uni.showLoading({ title: '评级中…' })
    const r = await api.post('/api/meals/' + mealId.value + '/confirm')
    uni.hideLoading()
    uni.showToast({ title: '已确认：' + r.evaluation.tierLabel, icon: 'none' })
    await load()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function voidIt() {
  const res = await new Promise((resolve) => {
    uni.showModal({ title: '确认作废', content: '作废后不计入图鉴进度，确定吗？', success: (r) => resolve(r.confirm) })
  })
  if (!res) return
  try {
    await api.post('/api/meals/' + mealId.value + '/void')
    uni.showToast({ title: '已作废', icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function preview() {
  const urls = meal.value.uploads.map((u) => BASE_URL + u.file_path)
  uni.previewImage({ urls, current: urls[0] })
}

onLoad((options) => {
  mealId.value = options.id
  load()
})
</script>

<style scoped>
.st-draft { background: #f1f2f5; color: #8a8f99; }
.st-confirmed { background: #e6f7ea; color: #2f9e44; }
.st-void { background: #fdeaea; color: #e64a45; }
.item-row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.item-row:last-child { border-bottom: none; }
.tier { font-size: 56rpx; font-weight: 800; }
.basis { margin-top: 12rpx; }
.basis-line { display: block; font-size: 26rpx; color: #5b6470; line-height: 1.8; }
.thumb { width: 180rpx; height: 180rpx; border-radius: 14rpx; margin: 0 16rpx 16rpx 0; background: #f1f2f5; }
</style>
