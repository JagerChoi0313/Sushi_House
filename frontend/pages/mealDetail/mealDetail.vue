<template>
  <view class="page" v-if="meal">
    <view class="card">
      <view class="row between">
        <text class="title">{{ fmtDate(meal.eaten_at) }}</text>
        <text :class="['pill', 'st-' + meal.status]">{{ statusLabel }}</text>
      </view>
      <view class="muted" style="margin-top: 10rpx">
        实付 ¥{{ fmtMoney(meal.actual_paid) }} · 自评 {{ stars(meal.rating) }}
      </view>
      <text v-if="meal.comment" style="display: block; margin-top: 14rpx">{{ meal.comment }}</text>
      <view v-if="isVoid" class="void-note">
        <text class="void-note-txt">这顿已作废，不计入图鉴进度与勋章统计，评级仅供参考。</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">菜品明细</text>
      <view v-for="it in meal.items" :key="it.id" class="item-row">
        <text class="flex1">{{ it.dish_name }}</text>
        <text class="muted" style="margin: 0 16rpx">x{{ it.quantity }}</text>
        <text>¥{{ fmtMoney(it.unit_price) }}</text>
        <text class="muted" style="margin-left: 16rpx">{{ it.unit_calories != null ? it.unit_calories + ' kcal' : '—' }}</text>
      </view>
    </view>

    <view v-if="meal.evaluation" class="card" :class="{ 'card-dim': isVoid }">
      <view class="row between">
        <text class="section-title">系统评级<text v-if="isVoid" class="muted">（已作废）</text></text>
      </view>
      <view class="row between">
        <text class="tier" :style="{ color: isVoid ? '#8a8f99' : tierColor(evalTierKey) }">{{ evalTierLabel }}</text>
        <text class="muted">{{ meal.evaluation.score }} 分</text>
      </view>
      <view class="basis">
        <text class="basis-line">预算：{{ budgetText }}</text>
        <text class="basis-line">热量：{{ calorieText }}</text>
        <text class="basis-line">口味匹配：{{ pct(basis.prefRatio) }}%</text>
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
  <view v-else class="empty">{{ loadError || '加载中…' }}</view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { BASE_URL, TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { errMsg, fmtDate, fmtMoney, pct, stars } from '../../common/util.js'

const meal = ref(null)
const mealId = ref(null)
const loadError = ref('')

const isVoid = computed(() => !!meal.value && meal.value.status === 'void')
const basis = computed(() => (meal.value && meal.value.evaluation && meal.value.evaluation.basis) || {})

// GET 详情返回的 evaluation 是库内原始行：tier 字段
// POST confirm 返回的是转换后形状：tierKey / tierLabel
// 这里统一兼容两种来源，避免字段名不一致导致档位空白
const evalTierKey = computed(() => {
  const e = meal.value && meal.value.evaluation
  if (!e) return ''
  return e.tierKey || e.tier || ''
})
const evalTierLabel = computed(() => {
  const e = meal.value && meal.value.evaluation
  if (!e) return ''
  return e.tierLabel || TIER_LABEL[evalTierKey.value] || evalTierKey.value || '—'
})

const statusLabel = computed(() => {
  const s = meal.value && meal.value.status
  return s === 'draft' ? '草稿' : s === 'confirmed' ? '已确认' : s === 'void' ? '已作废' : s
})

const budgetText = computed(() => {
  const b = basis.value
  if (b.budgetMet == null) return '未设置计划'
  if (b.budgetMet) return '达成 ✓'
  return '超支 ' + fmtMoney(b.budgetDelta) + ' 元'
})
const calorieText = computed(() => {
  const b = basis.value
  if (b.calorieMet == null) return '未设置上限'
  return b.calorieMet ? '达成 ✓' : '超出'
})

function tierColor(t) { return TIER_COLOR[t] || '#8a8f99' }

async function load() {
  try {
    meal.value = await api.get('/api/meals/' + mealId.value)
  } catch (e) {
    loadError.value = errMsg(e, '记录加载失败')
    uni.showToast({ title: loadError.value, icon: 'none' })
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
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

async function voidIt() {
  const ok = await new Promise((resolve) => {
    uni.showModal({ title: '确认作废', content: '作废后不计入图鉴进度，确定吗？', success: (r) => resolve(r.confirm) })
  })
  if (!ok) return
  try {
    await api.post('/api/meals/' + mealId.value + '/void')
    uni.showToast({ title: '已作废', icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

function preview() {
  const urls = meal.value.uploads.map((u) => BASE_URL + u.file_path)
  uni.previewImage({ urls, current: urls[0] })
}

onLoad((options) => {
  if (!options || !options.id) {
    loadError.value = '缺少记录编号'
    return
  }
  mealId.value = options.id
  load()
})
</script>

<style scoped>
.st-draft { background: #f1f2f5; color: #8a8f99; }
.st-confirmed { background: #e6f7ea; color: #2f9e44; }
.st-void { background: #fdeaea; color: #e64a45; }
.void-note { margin-top: 16rpx; padding: 14rpx 16rpx; background: #fdeaea; border-radius: 12rpx; }
.void-note-txt { font-size: 24rpx; color: #e64a45; line-height: 1.6; }
.card-dim { opacity: 0.75; }
.item-row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.item-row:last-child { border-bottom: none; }
.tier { font-size: 56rpx; font-weight: 800; }
.basis { margin-top: 12rpx; }
.basis-line { display: block; font-size: 26rpx; color: #5b6470; line-height: 1.8; }
.thumb { width: 180rpx; height: 180rpx; border-radius: 14rpx; margin: 0 16rpx 16rpx 0; background: #f1f2f5; }
</style>
