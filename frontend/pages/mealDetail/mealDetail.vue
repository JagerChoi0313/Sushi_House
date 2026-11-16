<template>
  <view class="page" v-if="meal">
    <view class="card">
      <view class="row between">
        <text class="title">{{ fmtDate(meal.eaten_at) }}</text>
        <text :class="['pill', 'st-' + meal.status]">{{ statusLabel }}</text>
      </view>
      <view class="muted" style="margin-top: 10rpx">
        {{ t('实付 ¥{x} · 自评 {s}', { x: fmtMoney(meal.actual_paid), s: stars(meal.rating) }) }}
      </view>
      <text v-if="meal.comment" style="display: block; margin-top: 14rpx">{{ meal.comment }}</text>
      <view v-if="isVoid" class="void-note">
        <text class="void-note-txt">{{ t('这顿已作废，不计入图鉴进度与勋章统计，评级仅供参考。') }}</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">{{ t('菜品明细') }}</text>
      <view v-for="it in meal.items" :key="it.id" class="item-row">
        <text class="flex1">{{ zh(it.dish_name) }}</text>
        <text class="muted" style="margin: 0 16rpx">x{{ it.quantity }}</text>
        <text>¥{{ fmtMoney(it.unit_price) }}</text>
        <text class="muted" style="margin-left: 16rpx">{{ it.unit_calories != null ? it.unit_calories + ' kcal' : '—' }}</text>
      </view>
    </view>

    <view v-if="meal.evaluation" class="card" :class="{ 'card-dim': isVoid }">
      <view class="row between">
        <text class="section-title">{{ t('系统评级') }}<text v-if="isVoid" class="muted">{{ t('（已作废）') }}</text></text>
      </view>
      <view v-if="showTier" class="row between">
        <text class="tier" :style="{ color: isVoid ? '#6b7280' : tierColor(evalTierKey) }">{{ evalTierLabel }}</text>
        <text class="muted">{{ t('{n} 分', { n: meal.evaluation.score }) }}</text>
      </view>
      <view v-else class="tier-off-tip">
        {{ t('你关掉了系统评级，档位与分数不显示。下面的预算 / 热量 / 口味匹配是这顿饭的事实，照常显示。') }}
      </view>
      <view class="basis">
        <text class="basis-line">{{ t('预算：{x}', { x: budgetText }) }}</text>
        <text class="basis-line">{{ t('热量：{x}', { x: calorieText }) }}</text>
        <text class="basis-line">{{ t('口味匹配：{n}%', { n: pct(basis.prefRatio) }) }}</text>
      </view>
    </view>

    <view v-if="meal.uploads && meal.uploads.length" class="card">
      <text class="section-title">{{ t('照片') }}</text>
      <view class="row wrap">
        <image
          v-for="u in meal.uploads"
          :key="u.id"
          :src="authImgUrl(u.file_path)"
          mode="aspectFill"
          class="thumb"
          @tap="preview"
        />
      </view>
      <text class="muted" style="display: block; margin-top: 8rpx">{{ t('这些照片只有你自己能看到。长按可以删除。') }}</text>
      <view class="row wrap" style="margin-top: 12rpx">
        <text
          v-for="u in meal.uploads"
          :key="'del-' + u.id"
          class="del-link"
          @tap="delUpload(u)" aria-role="button"
        >{{ t('删除照片') }}</text>
      </view>
    </view>

    <view v-if="meal.status === 'draft'" class="row" style="margin-top: 20rpx">
      <view class="btn btn-primary" style="flex: 1; margin-right: 16rpx" @tap="confirmIt" aria-role="button">{{ t('确认用餐') }}</view>
      <view class="btn btn-ghost" style="flex: 1" @tap="voidIt" aria-role="button">{{ t('作废') }}</view>
    </view>

    <!-- 审计 B3：用户要能把自己交出去的东西收回来 -->
    <view class="danger-zone">
      <text class="danger-title">{{ t('删除这条记录') }}</text>
      <text class="danger-note">
        {{ t('作废只是打上标记、不计入统计，记录本身还在。彻底删除会把明细、评级和它带来的图鉴进度一起回滚，找不回来。') }}
      </text>
      <view class="btn btn-danger" @tap="delMeal" aria-role="button">{{ t('彻底删除') }}</view>
    </view>
  </view>
  <view v-else class="empty">{{ loadError || t('加载中…') }}</view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { BASE_URL, authImgUrl, TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { errMsg, fmtDate, fmtMoney, pct, stars, zh } from '../../common/util.js'
import { showTier, syncShowTier } from '../../common/uiPrefs.js'
import { t, useLocale } from '../../common/i18n.js'

// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('记录详情')

syncShowTier()

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
  // 先用当前的 TIER_LABEL 翻译 key，再回落到库里存的那份 tierLabel。
  // 顺序不能反：tierLabel 是评级当时写进 meal_evaluations 的快照，
  // 还是旧 v1 的「顶级 / 人上人 / NPC / 拉完了」。key 一直没变，
  // 所以按 key 现翻一遍，历史记录就会自动跟着新词表走，不用改库（审计 B4）。
  return t(TIER_LABEL[evalTierKey.value] || e.tierLabel || evalTierKey.value || '—')
})

const statusLabel = computed(() => {
  const s = meal.value && meal.value.status
  return s === 'draft' ? t('草稿') : s === 'confirmed' ? t('已确认') : s === 'void' ? t('已作废') : s
})

const budgetText = computed(() => {
  const b = basis.value
  if (b.budgetMet == null) return t('未设置计划')
  if (b.budgetMet) return t('达成 ✓')
  return t('超支 {x} 元', { x: fmtMoney(b.budgetDelta) })
})
const calorieText = computed(() => {
  const b = basis.value
  if (b.calorieMet == null) return t('未设置上限')
  return b.calorieMet ? t('达成 ✓') : t('超出')
})

function tierColor(t) { return TIER_COLOR[t] || '#6b7280' }

async function load() {
  try {
    meal.value = await api.get('/api/meals/' + mealId.value)
  } catch (e) {
    loadError.value = errMsg(e, t('记录加载失败'))
    uni.showToast({ title: loadError.value, icon: 'none' })
  }
}

async function confirmIt() {
  try {
    uni.showLoading({ title: t('评级中…') })
    const r = await api.post('/api/meals/' + mealId.value + '/confirm')
    uni.hideLoading()
    uni.showToast({ title: t('已确认：{t}', { t: t(r.evaluation.tierLabel) }), icon: 'none' })
    await load()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

async function voidIt() {
  const ok = await new Promise((resolve) => {
    uni.showModal({ title: t('确认作废'), content: t('作废后不计入图鉴进度，确定吗？'), cancelText: t('取消'), confirmText: t('确定'),
      success: (r) => resolve(r.confirm) })
  })
  if (!ok) return
  try {
    await api.post('/api/meals/' + mealId.value + '/void')
    uni.showToast({ title: t('已作废'), icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

function preview() {
  const urls = meal.value.uploads.map((u) => authImgUrl(u.file_path))
  uni.previewImage({ urls, current: urls[0] })
}

/** 删除一张自己上传的照片（审计 B3：用户要能撤回自己交出去的东西） */
async function delUpload(u) {
  const ok = await new Promise((resolve) => {
    uni.showModal({
      title: t('删除这张照片'),
      content: t('照片会从服务器上删掉，删了找不回来。'),
      cancelText: t('取消'),
      confirmText: t('删除'),
      confirmColor: '#c0392f',
      success: (r) => resolve(r.confirm),
    })
  })
  if (!ok) return
  try {
    await api.del('/api/uploads/' + u.id)
    uni.showToast({ title: t('已删除'), icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

/** 物理删除整条记录（审计 B3）。作废只是打标记，删除才是真的不再存在。 */
async function delMeal() {
  const ok = await new Promise((resolve) => {
    uni.showModal({
      title: t('彻底删除这条记录'),
      content: t('明细、评级、图鉴进度都会一起回滚，删了找不回来。如果只是想让它不计入统计，用「作废」就好。'),
      cancelText: t('取消'),
      confirmText: t('彻底删除'),
      confirmColor: '#c0392f',
      success: (r) => resolve(r.confirm),
    })
  })
  if (!ok) return
  try {
    await api.del('/api/meals/' + mealId.value)
    uni.showToast({ title: t('已删除'), icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

onLoad((options) => {
  if (!options || !options.id) {
    loadError.value = t('缺少记录编号')
    return
  }
  mealId.value = options.id
  load()
})
</script>

<style scoped>
.st-draft { background: #f1f2f5; color: #5b6470; }
.st-confirmed { background: #e6f7ea; color: #1f7a33; }
.st-void { background: #fdeaea; color: #c0392f; }
.void-note { margin-top: 16rpx; padding: 14rpx 16rpx; background: #fdeaea; border-radius: 12rpx; }
.void-note-txt { font-size: 24rpx; color: #c0392f; line-height: 1.6; }
.card-dim { opacity: 0.75; }
.item-row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.item-row:last-child { border-bottom: none; }
.tier { font-size: 56rpx; font-weight: 800; }
/* 审计 B4：关掉评级后的替代表述。不用灰字小字，否则等于换个方式贬低同一个信息 */
.tier-off-tip { font-size: 26rpx; color: #5b6470; line-height: 1.7; }
.basis { margin-top: 12rpx; }
.basis-line { display: block; font-size: 26rpx; color: #5b6470; line-height: 1.8; }
.thumb { width: 180rpx; height: 180rpx; border-radius: 14rpx; margin: 0 16rpx 16rpx 0; background: #f1f2f5; }
.del-link { font-size: 24rpx; color: #c0392f; margin-right: 24rpx; padding: 8rpx 0; }
.danger-zone { margin-top: 40rpx; padding: 24rpx; border: 1rpx solid #f3d3d3; border-radius: 16rpx; background: #fffafa; }
.danger-title { font-size: 28rpx; font-weight: 600; color: #b23c38; display: block; }
.danger-note { font-size: 24rpx; color: #6b7280; line-height: 1.7; display: block; margin: 10rpx 0 18rpx; }
.btn-danger { background: #fdeaea; color: #b23c38; font-size: 28rpx; padding: 18rpx; border-radius: 12rpx; text-align: center; }
</style>
