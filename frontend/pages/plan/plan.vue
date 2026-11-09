<template>
  <view class="page">
    <view class="card">
      <text class="section-title">餐前推荐</text>
      <view class="field">
        <text class="label">单人预算（元）*</text>
        <input class="input" type="digit" v-model="budget" placeholder="例如 80" />
      </view>
      <view class="field">
        <text class="label">热量上限（可选）</text>
        <input class="input" type="digit" v-model="calorieLimit" placeholder="例如 600 kcal，留空不限" />
      </view>
      <button class="btn btn-primary" :disabled="loading" @tap="generate">
        {{ loading ? '计算中…' : '生成推荐组合' }}
      </button>
      <text class="muted tip">会先排除你的忌口 / 过敏标签，再按喜欢口味排序，尽量贴近预算。</text>
    </view>

    <view v-if="error" class="card"><text style="color: #e64a45">{{ error }}</text></view>

    <view v-if="plan" class="card">
      <view class="row between">
        <text class="section-title">推荐结果</text>
        <text class="muted">剩余预算 ¥{{ fmtMoney(plan.remaining) }}</text>
      </view>
      <view class="totals">
        <view class="total">
          <text class="total-num">¥{{ fmtMoney(plan.estimatedPrice) }}</text>
          <text class="muted">预计总价</text>
        </view>
        <view class="total">
          <text class="total-num">{{ plan.estimatedCalories }}</text>
          <text class="muted">预计热量 kcal</text>
        </view>
      </view>
      <view v-for="it in plan.items" :key="it.dishId" class="item-row">
        <text class="flex1">{{ it.name }}</text>
        <text class="muted" style="margin: 0 20rpx">x{{ it.quantity }}</text>
        <text class="price">¥{{ fmtMoney(it.unitPrice) }}</text>
      </view>
      <button class="btn btn-primary" style="margin-top: 24rpx" @tap="usePlan">用这个计划去记录</button>
    </view>

    <!-- 历史计划：后端有 GET /api/plans，此前前端没有入口 -->
    <view class="card">
      <view class="row between">
        <text class="section-title">历史计划{{ history.length ? '（' + history.length + '）' : '' }}</text>
        <text class="clear-link" @tap="loadHistory">刷新</text>
      </view>
      <view v-if="!history.length" class="empty">还没有生成过计划</view>
      <view v-for="h in shownHistory" :key="h.id" class="item-row" @tap="openHistory(h.id)">
        <view class="flex1">
          <text class="h-title">预算 ¥{{ fmtMoney(h.budget) }} · 预计 ¥{{ fmtMoney(h.estimated_price) }}</text>
          <text class="muted h-sub">{{ fmtDate(h.created_at) }} · {{ h.item_count }} 道菜<text v-if="h.calorie_limit"> · 上限 {{ h.calorie_limit }} kcal</text></text>
        </view>
        <text class="muted">›</text>
      </view>
      <view v-if="shownHistory.length < history.length" class="load-more">
        <text class="more-link" @tap="showMoreHistory">加载更多（{{ shownHistory.length }}/{{ history.length }}）</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { errMsg, fmtDate, fmtMoney } from '../../common/util.js'

const STEP = 20

const budget = ref('80')
const calorieLimit = ref('')
const loading = ref(false)
const error = ref('')
const plan = ref(null)

const history = ref([])
const historyLimit = ref(STEP)
const shownHistory = computed(() => history.value.slice(0, historyLimit.value))

async function generate() {
  error.value = ''
  plan.value = null
  const b = Number(budget.value)
  if (!b || b <= 0) return uni.showToast({ title: '请输入预算', icon: 'none' })
  loading.value = true
  try {
    plan.value = await api.post('/api/plans/generate', {
      budget: b,
      calorieLimit: calorieLimit.value === '' ? null : Number(calorieLimit.value),
    })
    loadHistory()
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
}

function usePlan() {
  uni.navigateTo({ url: '/pages/record/record?planId=' + plan.value.planId })
}

async function loadHistory() {
  try {
    const d = await api.get('/api/plans')
    history.value = d.plans || []
    historyLimit.value = STEP
  } catch (e) {
    /* 历史拉取失败不打断主流程 */
  }
}

function showMoreHistory() {
  historyLimit.value += STEP
}

function openHistory(id) {
  uni.navigateTo({ url: '/pages/record/record?planId=' + id })
}

onShow(() => loadHistory())
</script>

<style scoped>
.field { margin-bottom: 24rpx; }
.label { display: block; font-size: 24rpx; color: #5b6470; margin-bottom: 10rpx; }
.tip { display: block; margin-top: 18rpx; line-height: 1.6; }
.totals { display: flex; margin: 8rpx 0 16rpx; }
.total { flex: 1; text-align: center; background: #f7f8fa; border-radius: 16rpx; padding: 20rpx; margin-right: 16rpx; }
.total:last-child { margin-right: 0; }
.total-num { display: block; font-size: 40rpx; font-weight: 700; color: #e64a45; }
.item-row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.item-row:last-child { border-bottom: none; }
.price { color: #e64a45; font-weight: 600; }
.clear-link { color: #3b82f6; font-size: 24rpx; }
.h-title { display: block; font-size: 27rpx; font-weight: 600; }
.h-sub { display: block; margin-top: 6rpx; }
.load-more { text-align: center; padding: 16rpx 0 8rpx; }
.more-link { color: #3b82f6; font-size: 26rpx; }
</style>
