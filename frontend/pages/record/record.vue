<template>
  <view class="page record-page">
    <view class="card" v-if="plan">
      <text class="muted">来自推荐计划 · 预算 ¥{{ plan.budget }}<text v-if="plan.calorie_limit"> · 热量上限 {{ plan.calorie_limit }} kcal</text></text>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">本次菜品</text>
        <picker :range="dishLabels" @change="onPickDish">
          <view class="btn btn-sm btn-ghost">＋ 添加菜品</view>
        </picker>
      </view>
      <view v-if="!items.length" class="empty">还没有菜品，点右上角添加，或用下方拍照识别</view>
      <view v-for="(it, idx) in items" :key="idx" class="item">
        <view class="flex1">
          <text class="item-name">{{ it.dishName }}</text>
          <text class="muted item-sub">¥{{ it.unitPrice }}<text v-if="it.unitCalories != null"> · {{ it.unitCalories }} kcal</text></text>
        </view>
        <view class="qty">
          <view class="qty-btn" @tap="changeQty(idx, -1)">－</view>
          <text class="qty-num">{{ it.quantity }}</text>
          <view class="qty-btn" @tap="changeQty(idx, 1)">＋</view>
        </view>
        <text class="del" @tap="removeItem(idx)">删除</text>
      </view>
      <view class="divider"></view>
      <view class="row between">
        <text class="muted">菜单价估算</text>
        <text class="price">¥{{ estimatePrice }}</text>
      </view>
      <view class="row between" style="margin-top: 8rpx">
        <text class="muted">热量估算</text>
        <text class="price">{{ estimateCalories }} kcal</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">账单与评分</text>
      <view class="field">
        <text class="label">账单实付（元）</text>
        <input class="input" type="digit" v-model="actualPaid" placeholder="例如 76" />
      </view>
      <view class="field">
        <text class="label">自评（1-5 星）</text>
        <view class="stars">
          <text v-for="i in 5" :key="i" class="star" @tap="rating = i">{{ i <= rating ? '★' : '☆' }}</text>
        </view>
      </view>
      <view class="field">
        <text class="label">短评</text>
        <textarea class="input-area" v-model="comment" placeholder="这顿吃得怎么样？" :maxlength="200" />
      </view>
    </view>

    <view class="card">
      <text class="section-title">照片识别（模拟）</text>
      <text class="muted">上传账单或菜品照片，系统会先给出一份草稿，你可以自由修改。</text>
      <view class="row" style="margin-top: 20rpx">
        <view class="btn btn-sm btn-ghost" @tap="pickImage('bill')">上传账单照片</view>
        <view class="btn btn-sm btn-ghost" style="margin-left: 16rpx" @tap="pickImage('dish')">上传菜品照片</view>
      </view>
      <text v-if="uploadIds.length" class="muted" style="display: block; margin-top: 14rpx">已上传 {{ uploadIds.length }} 张图片</text>
    </view>

    <view v-if="result" class="card result-card">
      <text class="muted">本次用餐评级</text>
      <text class="tier" :style="{ color: tierColor(result.evaluation.tierKey) }">{{ result.evaluation.tierLabel }}</text>
      <text class="muted">综合得分 {{ result.evaluation.score }} 分</text>
      <view class="basis">
        <text class="basis-line">预算：{{ result.evaluation.basis.budgetMet == null ? '未设置计划' : result.evaluation.basis.budgetMet ? '达成 ✓' : '超支 ' + result.evaluation.basis.budgetDelta + ' 元' }}</text>
        <text class="basis-line">热量：{{ result.evaluation.basis.calorieMet == null ? '未设置上限' : result.evaluation.basis.calorieMet ? '达成 ✓' : '超出' }}</text>
        <text class="basis-line">口味匹配：{{ Math.round((result.evaluation.basis.prefRatio || 0) * 100) }}%</text>
      </view>
      <view v-if="result.badges && result.badges.length" class="new-badges">
        <text class="muted">🎉 新获得勋章：</text>
        <text v-for="b in result.badges" :key="b.id" class="tag">{{ b.name }}</text>
      </view>
      <button class="btn btn-primary" style="margin-top: 20rpx" @tap="goHistory">查看用餐历史</button>
    </view>

    <view class="footer">
      <view class="btn btn-ghost" style="flex: 1; margin-right: 16rpx" @tap="saveDraft">保存草稿</view>
      <view class="btn btn-primary" style="flex: 1" :class="{ disabled: confirmed }" @tap="confirmMeal">
        {{ confirmed ? '已确认' : '确认用餐' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, uploadImage } from '../../common/api.js'
import { TIER_COLOR } from '../../common/config.js'

const dishes = ref([])
const items = ref([])
const planId = ref(null)
const plan = ref(null)
const mealId = ref(null)
const actualPaid = ref('')
const rating = ref(0)
const comment = ref('')
const uploadIds = ref([])
const result = ref(null)
const confirmed = ref(false)
const saving = ref(false)

const dishLabels = computed(() => dishes.value.map((d) => `${d.name}  ¥${d.price}`))
const estimatePrice = computed(() => items.value.reduce((s, it) => s + (Number(it.unitPrice) || 0) * it.quantity, 0).toFixed(1))
const estimateCalories = computed(() => items.value.reduce((s, it) => s + (it.unitCalories != null ? Number(it.unitCalories) : 0) * it.quantity, 0))

function tierColor(t) { return TIER_COLOR[t] || '#8a8f99' }
function toast(t) { uni.showToast({ title: t, icon: 'none' }) }

function addDishById(id) {
  const d = dishes.value.find((x) => x.id === Number(id))
  if (!d) return
  items.value.push({ dishId: d.id, dishName: d.name, quantity: 1, unitPrice: d.price, unitCalories: d.calories, source: 'manual' })
}

function onPickDish(e) {
  const d = dishes.value[Number(e.detail.value)]
  if (d) addDishById(d.id)
}

function changeQty(idx, delta) {
  const it = items.value[idx]
  it.quantity = Math.max(1, it.quantity + delta)
}

function removeItem(idx) {
  items.value.splice(idx, 1)
}

function buildItems() {
  return items.value.map((it) => ({
    dishId: it.dishId,
    dishName: it.dishName,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    unitCalories: it.unitCalories,
    source: it.source,
  }))
}

function buildPayload() {
  return {
    planId: planId.value || null,
    actualPaid: actualPaid.value === '' ? null : Number(actualPaid.value),
    rating: rating.value || null,
    comment: comment.value || null,
    uploadIds: uploadIds.value,
    items: buildItems(),
  }
}

async function ensureSaved() {
  saving.value = true
  try {
    const payload = buildPayload()
    if (mealId.value) {
      await api.put('/api/meals/' + mealId.value, payload)
    } else {
      const d = await api.post('/api/meals', payload)
      mealId.value = d.id
    }
    return mealId.value
  } finally {
    saving.value = false
  }
}

async function saveDraft() {
  try {
    await ensureSaved()
    toast('已保存草稿')
  } catch (e) {
    toast(e.message)
  }
}

async function confirmMeal() {
  if (!items.value.length) return toast('请先添加菜品')
  try {
    await ensureSaved()
    const r = await api.post('/api/meals/' + mealId.value + '/confirm')
    result.value = r
    confirmed.value = true
    toast('已确认用餐')
  } catch (e) {
    toast(e.message)
  }
}

function pickImage(type) {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      try {
        uni.showLoading({ title: '识别中…' })
        const up = await uploadImage(type, res.tempFilePaths[0])
        uploadIds.value.push(up.id)
        const ocr = await api.post('/api/uploads/' + up.id + '/ocr')
        for (const it of ocr.items) {
          items.value.push({
            dishId: it.dishId,
            dishName: it.dishName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCalories: it.unitCalories,
            source: it.source,
          })
        }
        uni.hideLoading()
        toast('识别完成，请核对后确认')
      } catch (e) {
        uni.hideLoading()
        toast(e.message)
      }
    },
  })
}

function goHistory() {
  uni.reLaunch({ url: '/pages/history/history' })
}

onLoad(async (options) => {
  try {
    const data = await api.get('/api/dishes?status=on_sale')
    dishes.value = data.dishes || []
  } catch (e) {
    /* ignore */
  }
  if (options && options.planId) {
    planId.value = Number(options.planId)
    try {
      const p = await api.get('/api/plans/' + planId.value)
      plan.value = p.plan
      items.value = (p.plan.items || []).map((it) => ({
        dishId: it.dish_id,
        dishName: it.dish_name,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        unitCalories: it.unit_calories,
        source: 'manual',
      }))
    } catch (e) {
      toast(e.message)
    }
  } else if (options && options.dishId) {
    addDishById(options.dishId)
  }
})
</script>

<style scoped>
.record-page { padding-bottom: 180rpx; }
.field { margin-bottom: 24rpx; }
.label { display: block; font-size: 24rpx; color: #5b6470; margin-bottom: 10rpx; }
.item { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.item-name { font-size: 28rpx; font-weight: 500; }
.item-sub { display: block; margin-top: 4rpx; }
.qty { display: flex; align-items: center; margin: 0 20rpx; }
.qty-btn {
  width: 52rpx; height: 52rpx; border-radius: 50%; background: #f1f2f5;
  display: flex; align-items: center; justify-content: center; font-size: 30rpx; color: #5b6470;
}
.qty-num { min-width: 52rpx; text-align: center; font-size: 28rpx; }
.del { color: #e64a45; font-size: 24rpx; }
.price { color: #e64a45; font-weight: 600; }
.stars { display: flex; }
.star { font-size: 52rpx; color: #f59f00; margin-right: 12rpx; }
.result-card { text-align: center; }
.tier { display: block; font-size: 72rpx; font-weight: 800; margin: 12rpx 0; }
.basis { margin-top: 16rpx; }
.basis-line { display: block; font-size: 26rpx; color: #5b6470; line-height: 1.8; }
.new-badges { margin-top: 18rpx; }
.footer {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: #fff; padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  display: flex; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.05); z-index: 20;
}
</style>
