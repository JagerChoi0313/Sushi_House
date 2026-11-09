<template>
  <view class="page record-page">
    <view class="card" v-if="plan">
      <text class="muted">来自推荐计划 · 预算 ¥{{ fmtMoney(plan.budget) }}<text v-if="plan.calorie_limit"> · 热量上限 {{ plan.calorie_limit }} kcal</text></text>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">本次菜品</text>
        <view class="btn btn-sm btn-ghost" @tap="openPicker">＋ 添加菜品</view>
      </view>
      <view v-if="!items.length" class="empty">还没有菜品，点右上角添加，或用下方拍照识别</view>
      <view v-for="(it, idx) in items" :key="idx" class="item">
        <view class="flex1">
          <text class="item-name">{{ it.dishName }}</text>
          <text class="muted item-sub">¥{{ fmtMoney(it.unitPrice) }}<text v-if="it.unitCalories != null"> · {{ it.unitCalories }} kcal</text></text>
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
      <text class="section-title">照片识别（演示）</text>
      <text class="muted">上传账单或菜品照片后，系统会加入一份草稿，你可以自由修改。</text>
      <text class="muted" style="display: block; margin-top: 10rpx; color: #b06a3b">
        当前版本尚未接入真实 OCR：草稿是从在售菜品里随机取的示例数据，不是从照片里读出来的。
      </text>
      <view class="row" style="margin-top: 20rpx">
        <view class="btn btn-sm btn-ghost" @tap="pickImage('bill')">上传账单照片</view>
        <view class="btn btn-sm btn-ghost" style="margin-left: 16rpx" @tap="pickImage('dish')">上传菜品照片</view>
      </view>
      <text v-if="uploadIds.length" class="muted" style="display: block; margin-top: 14rpx">已上传 {{ uploadIds.length }} 张图片</text>
      <text v-if="demoUsed" class="muted" style="display: block; margin-top: 10rpx; color: #b06a3b">
        已加入的菜品标记为 source=mock —— 演示数据，请逐条核对或删除。
      </text>
    </view>

    <view v-if="result" class="card result-card">
      <text class="muted">本次用餐评级</text>
      <text class="tier" :style="{ color: tierColor(result.evaluation.tierKey) }">{{ result.evaluation.tierLabel }}</text>
      <text class="muted">综合得分 {{ result.evaluation.score }} 分</text>
      <view class="basis">
        <text class="basis-line">预算：{{ budgetText(result.evaluation.basis) }}</text>
        <text class="basis-line">热量：{{ calorieText(result.evaluation.basis) }}</text>
        <text class="basis-line">口味匹配：{{ pct(result.evaluation.basis.prefRatio) }}%</text>
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

    <!-- 菜品选择：改用可搜索弹层，替代原先把 270 道菜塞进 picker 的做法 -->
    <view v-if="pickerOpen" class="mask" @tap="pickerOpen = false">
      <view class="sheet" @tap.stop>
        <view class="row between">
          <text class="section-title">选择菜品（{{ pickerList.length }}）</text>
          <text class="muted" @tap="pickerOpen = false">关闭 ✕</text>
        </view>
        <input
          class="input"
          v-model="pickerSearch"
          placeholder="搜索菜名，如 三文鱼"
          confirm-type="search"
          style="margin-bottom: 16rpx"
        />
        <scroll-view scroll-y class="picker-list" @scrolltolower="loadMorePicker">
          <view v-if="!pickerList.length" class="empty">没有匹配的菜品</view>
          <view v-for="d in pickerList" :key="d.id" class="picker-row" @tap="pickDish(d)">
            <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="picker-thumb" lazy-load />
            <view class="flex1">
              <text class="item-name">{{ d.name }}</text>
              <text class="muted item-sub">¥{{ fmtMoney(d.price) }}<text v-if="d.calories != null"> · {{ d.calories }} kcal</text></text>
            </view>
            <text class="add-txt">＋</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, uploadImage } from '../../common/api.js'
import { BASE_URL, TIER_COLOR } from '../../common/config.js'
import { errMsg, fmtMoney, pct } from '../../common/util.js'

const dishes = ref([])
const items = ref([])
const planId = ref(null)
const plan = ref(null)
const mealId = ref(null)
const actualPaid = ref('')
const rating = ref(0)
const comment = ref('')
const uploadIds = ref([])
const demoUsed = ref(false)
const result = ref(null)
const confirmed = ref(false)
const saving = ref(false)

const pickerOpen = ref(false)
const pickerSearch = ref('')
const pickerLimit = ref(40)

const pickerList = computed(() => {
  const kw = pickerSearch.value.trim().toLowerCase()
  const base = kw ? dishes.value.filter((d) => String(d.name).toLowerCase().indexOf(kw) >= 0) : dishes.value
  return base.slice(0, pickerLimit.value)
})

const estimatePrice = computed(() =>
  items.value.reduce((s, it) => s + (Number(it.unitPrice) || 0) * it.quantity, 0).toFixed(1)
)
const estimateCalories = computed(() =>
  items.value.reduce((s, it) => s + (it.unitCalories != null ? Number(it.unitCalories) : 0) * it.quantity, 0)
)

function tierColor(t) { return TIER_COLOR[t] || '#8a8f99' }
function toast(t) { uni.showToast({ title: String(t || ''), icon: 'none' }) }

function budgetText(b) {
  if (!b || b.budgetMet == null) return '未设置计划'
  if (b.budgetMet) return '达成 ✓'
  return '超支 ' + fmtMoney(b.budgetDelta) + ' 元'
}
function calorieText(b) {
  if (!b || b.calorieMet == null) return '未设置上限'
  return b.calorieMet ? '达成 ✓' : '超出'
}

function openPicker() {
  pickerSearch.value = ''
  pickerLimit.value = 40
  pickerOpen.value = true
}
function loadMorePicker() {
  pickerLimit.value += 40
}
function pickDish(d) {
  addDishById(d.id)
  pickerOpen.value = false
}

function addDishById(id) {
  const d = dishes.value.find((x) => x.id === Number(id))
  if (!d) return
  items.value.push({
    dishId: d.id,
    dishName: d.name,
    quantity: 1,
    unitPrice: d.price,
    unitCalories: d.calories,
    source: 'manual',
  })
}

function changeQty(idx, delta) {
  const it = items.value[idx]
  it.quantity = Math.max(1, it.quantity + delta)
}

function removeItem(idx) {
  items.value.splice(idx, 1)
}

function buildPayload() {
  return {
    planId: planId.value || null,
    actualPaid: actualPaid.value === '' ? null : Number(actualPaid.value),
    rating: rating.value || null,
    comment: comment.value || null,
    uploadIds: uploadIds.value,
    items: items.value.map((it) => ({
      dishId: it.dishId,
      dishName: it.dishName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      unitCalories: it.unitCalories,
      source: it.source,
    })),
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
    toast(errMsg(e))
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
    toast(errMsg(e))
  }
}

function pickImage(type) {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      try {
        uni.showLoading({ title: '生成草稿…' })
        const up = await uploadImage(type, res.tempFilePaths[0])
        uploadIds.value.push(up.id)
        const ocr = await api.post('/api/uploads/' + up.id + '/ocr')
        let added = 0
        for (const it of ocr.items || []) {
          items.value.push({
            dishId: it.dishId,
            dishName: it.dishName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCalories: it.unitCalories,
            source: it.source,
          })
          if (it.source === 'mock') demoUsed.value = true
          added++
        }
        uni.hideLoading()
        toast(added ? '已加入 ' + added + ' 条演示草稿，请核对后修改' : '没有可加入的草稿')
      } catch (e) {
        uni.hideLoading()
        toast(errMsg(e))
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
    /* 菜品池拉取失败时仍可手动保存草稿 */
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
      toast(errMsg(e))
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
.mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45); display: flex; align-items: flex-end; z-index: 9999;
}
.sheet {
  width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box; max-height: 80vh; display: flex; flex-direction: column;
}
.picker-list { max-height: 60vh; }
.picker-row { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.picker-thumb { width: 96rpx; height: 96rpx; border-radius: 12rpx; margin-right: 20rpx; background: #f1f2f5; }
.add-txt { color: #e64a45; font-size: 40rpx; font-weight: 700; padding: 0 10rpx; }
</style>
