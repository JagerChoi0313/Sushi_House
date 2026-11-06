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
        <text class="muted">剩余预算 ¥{{ plan.remaining }}</text>
      </view>
      <view class="totals">
        <view class="total">
          <text class="total-num">¥{{ plan.estimatedPrice }}</text>
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
        <text class="price">¥{{ it.unitPrice }}</text>
      </view>
      <button class="btn btn-primary" style="margin-top: 24rpx" @tap="usePlan">用这个计划去记录</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../../common/api.js'

const budget = ref('80')
const calorieLimit = ref('')
const loading = ref(false)
const error = ref('')
const plan = ref(null)

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
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function usePlan() {
  uni.navigateTo({ url: '/pages/record/record?planId=' + plan.value.planId })
}
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
</style>
