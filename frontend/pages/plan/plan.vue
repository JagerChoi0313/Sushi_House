<template>
  <view class="page" :class="{ 'no-anim': noAnim }">
    <view class="card">
      <text class="section-title">{{ t('餐前推荐') }}</text>
      <view class="field">
        <text class="label">{{ t('单人预算（元）*') }}</text>
        <input class="input" type="digit" v-model="budget" :placeholder="t('例如 80')" />
        <!-- 问卷 29 份里 86% 的人均消费落在 ¥50–120，这三档就是照那个结果定的 -->
        <view class="chips">
          <text
            v-for="b in budgetPresets"
            :key="b.value"
            class="chip-sm"
            :class="{ 'chip-sm-on': budget === String(b.value) }"
            @tap="budget = String(b.value)" aria-role="button"
          >{{ b.label }}</text>
        </view>
      </view>
      <!-- 健康目标：问卷第 3 题第 21 条要的就是这个（按减重 / 控糖 / 轻食分组给套餐）。
           库里没有糖分、蛋白质、钠这些字段，只有 18 个标签 + 热量，
           所以这三档只做「一个默认热量区间 + 一个标签排除集」，界面上必须说清是推断。 -->
      <view class="field">
        <text class="label">{{ t('健康目标（可选）') }}</text>
        <view class="chips">
          <text
            v-for="g in goalOptions"
            :key="g.key"
            class="chip-sm"
            :class="{ 'chip-sm-on': goal === g.key }"
            @tap="pickGoal(g)" aria-role="button"
          >{{ t(g.label) }}</text>
        </view>
        <text class="muted tip" v-if="goalHint">{{ goalHint }}</text>
      </view>
      <view class="field">
        <text class="label">{{ t('热量区间（可选）') }}</text>
        <view class="range-row">
          <input class="input range-in" type="digit" v-model="calorieMin" :placeholder="t('下限')" />
          <text class="range-dash">–</text>
          <input class="input range-in" type="digit" v-model="calorieMax" :placeholder="t('上限')" />
          <text class="muted range-unit">kcal</text>
        </view>
        <view class="chips">
          <text
            v-for="p in calPresets"
            :key="p.label"
            class="chip-sm"
            :class="{ 'chip-sm-on': calorieMin === String(p.min) && calorieMax === String(p.max) }"
            @tap="pickRange(p)" aria-role="button"
          >{{ t(p.label) }}</text>
          <text class="chip-sm" @tap="clearRange" aria-role="button">{{ t('不限') }}</text>
        </view>
        <text class="muted tip">
        {{ t('只填上限也行。下限留空时，系统会拿上限的 80% 作为「至少要吃够」的目标，然后在上限以内尽量往上凑；两框都填就按你填的来。下限填得比上限大时会直接报错，不会偷偷改你的数。') }}
      </text>
      </view>
      <!-- 儿童模式：库里没有辣度和份量字段，能用的只有标签，所以只做保守的两件事 -->
      <view class="field">
        <view class="row between" @tap="kidMode = !kidMode" aria-role="button">
          <text class="label" style="margin-bottom: 0">{{ t('儿童套餐模式') }}</text>
          <view class="sw" :class="{ 'sw-on': kidMode }"><view class="sw-dot"></view></view>
        </view>
        <text class="muted tip">
          {{ t('开了之后：不选生食与苦味的菜、甜味的菜优先，每样只点一份。孩子的辣度和份量我们没有字段，这两项不做判断。') }}
        </text>
      </view>
      <button class="btn btn-primary" :class="{ 'anim-pulse': loading }" :disabled="loading" @tap="generate">
        {{ loading ? t('计算中…') : t('生成推荐组合') }}
      </button>
      <button class="btn btn-ghost anim-pulse" v-if="loading" style="margin-top: 16rpx" disabled>
        {{ t('正在算三套…') }}
      </button>
      <button v-else class="btn btn-ghost" style="margin-top: 16rpx" @tap="compare">
        {{ t('一次看三套（省钱 / 均衡 / 吃饱）') }}
      </button>
      <text class="muted tip">{{ t('会先排除你的忌口 / 过敏标签，再按喜欢口味排序，尽量贴近预算。') }}</text>
    </view>

    <view v-if="error" class="card"><text style="color: #c0392f">{{ error }}</text></view>

    <!-- 三套对比：只在内存里算，点「用这套」才真正落库 -->
    <view v-if="variants" class="card">
      <view class="row between">
        <text class="section-title">{{ t('三套方案') }}</text>
        <text class="muted" @tap="variants = null" style="padding: 8rpx 12rpx" aria-role="button">{{ t('收起 ✕') }}</text>
      </view>
      <text class="muted tip" style="margin-bottom: 12rpx">
        {{ t('同一个预算和热量区间，三种点法。都还没保存，选一套再生成。') }}
      </text>
      <!-- 实测发现：不填热量上限时三套会算出同一个结果，因为三种策略的差别全在「热量目标」上。
           这里如实提示，并给一个一键补区间的按钮，而不是假装三套不一样。 -->
      <view v-if="variantSpread === 'same'" class="same-note">
        <text class="muted same-text">
          {{ t('这次三套算出来是一样的 —— 三种策略的差别全在「热量目标」上，没填上限时它们就退化成同一种点法。填个区间再比一次就能看出区别。') }}
        </text>
        <text class="same-btn" @tap="fillRangeAndCompare" aria-role="button">{{ t('用「正常 500–700」再比') }}</text>
      </view>
      <view v-for="v in variants" :key="v.key" class="va-card anim-pop" :class="{ 'va-off': !v.ok }">
        <view class="row between">
          <text class="va-title">{{ t(v.label) }}</text>
          <text v-if="v.ok" class="va-price">¥{{ fmtMoney(v.plan.estimatedPrice) }}</text>
          <text v-else class="muted">{{ t('不可行') }}</text>
        </view>
        <text class="muted va-hint">{{ t(v.hint) }}</text>
        <template v-if="v.ok">
          <text class="muted va-meta">
            ≈{{ v.plan.estimatedCalories }} kcal
            <text v-if="v.plan.calorieFill != null">{{ t(' · 达到{base}的 {n}%', { base: v.plan.calorieFillBase === 'target' ? t('目标') : t('上限'), n: v.plan.calorieFill }) }}</text>
            {{ t(' · {n} 道', { n: v.plan.items.length }) }}
          </text>
          <view class="va-items">
            <text v-for="it in v.plan.items" :key="it.dishId" class="va-item">
              {{ it.quantity > 1 ? it.quantity + '×' + zh(it.name) : zh(it.name) }}
            </text>
          </view>
          <button class="btn btn-ghost va-btn" @tap="useVariant(v)">{{ t('用这套') }}</button>
        </template>
        <text v-else class="muted va-meta">{{ t(v.error) }}</text>
      </view>
    </view>

    <view v-if="plan" class="card anim-card">
      <view class="row between">
        <text class="section-title">{{ t('推荐结果') }}</text>
        <text class="muted">{{ t('剩余预算 ¥{x}', { x: fmtMoney(plan.remaining) }) }}</text>
      </view>
      <view class="totals">
        <view class="total">
          <text class="total-num">¥{{ fmtMoney(plan.estimatedPrice) }}</text>
          <text class="muted">{{ t('预计总价') }}</text>
        </view>
        <view class="total">
          <text class="total-num">≈{{ plan.estimatedCalories }}</text>
          <text class="muted">{{ t('预计热量 kcal') }}</text>
        </view>
      </view>
      <!-- 达标率：以前填了上限也常常只凑到两三成，这行直接把它摊开给用户看 -->
      <view v-if="plan.calorieLimit" class="fill">
        <view class="fill-bar">
          <view class="fill-in" :style="{ width: Math.min(100, plan.calorieFill || 0) + '%' }"></view>
        </view>
        <text class="muted fill-text">
          {{ t('热量 ≈{a} / {b} {c} kcal（{d}%）', { a: plan.estimatedCalories, b: plan.calorieFillBase === 'target' ? t('目标') : t('上限'), c: plan.calorieFillBase === 'target' ? plan.calorieTarget : plan.calorieLimit, d: plan.calorieFill }) }}<text v-if="plan.calorieMin">{{ t(' · 你填的下限 {n}', { n: plan.calorieMin }) }}</text>
          <text v-else-if="plan.calorieTargetAuto">{{ t(' · 未填下限，按目标的 {n} 去凑', { n: plan.calorieTarget }) }}</text>
        </text>
        <text v-if="(plan.calorieFill || 0) < 80" class="muted fill-warn">
          {{ t('预算用完也只够这么多，想更接近{base}可以抬预算或换个区间。', { base: plan.calorieFillBase === 'target' ? t('目标') : t('上限') }) }}
        </text>
      </view>
      <!-- 目标不是营养学判定，是标签推断：把「按什么排的」写在结果旁边，别让它只留在选择器里 -->
      <view v-if="plan.goalLabel" class="goal-box">
        <text class="goal-title">{{ t('目标是「{g}」', { g: t(plan.goalLabel) }) }}</text>
        <text class="muted goal-note">{{ tGoalNote(plan.goalNote) }}</text>
        <text v-if="plan.goal === 'blood_sugar'" class="muted goal-warn">
          {{ t('注意：我们只有「甜味」标签，没有糖分数据。咸味菜里的隐形糖、标了无糖但含淀粉的菜，这套都判不出来。') }}
        </text>
      </view>
      <view class="anim-list">
        <view v-for="it in plan.items" :key="it.dishId" class="item-row">
          <text class="flex1">{{ zh(it.name) }}</text>
          <text class="muted" style="margin: 0 20rpx">x{{ it.quantity }}</text>
          <text class="price">¥{{ fmtMoney(it.unitPrice) }}</text>
        </view>
      </view>
      <button class="btn btn-primary" style="margin-top: 24rpx" @tap="usePlan">{{ t('用这个计划去记录') }}</button>
    </view>

    <!-- 历史计划：后端有 GET /api/plans，此前前端没有入口 -->
    <view class="card">
      <view class="row between">
        <text class="section-title">{{ t('历史计划') }}{{ historyTotal ? t('（{n}）', { n: historyTotal }) : '' }}</text>
        <text class="clear-link" @tap="loadHistory()" aria-role="button">{{ t('刷新') }}</text>
      </view>
      <view v-if="!history.length" class="empty">{{ t('还没有生成过计划') }}</view>
      <view v-for="h in shownHistory" :key="h.id" class="item-row">
        <view class="flex1" @tap="openHistory(h.id)" aria-role="button">
          <text class="h-title">{{ t('预算 ¥{a} · 预计 ¥{b}', { a: fmtMoney(h.budget), b: fmtMoney(h.estimated_price) }) }}</text>
          <text class="muted h-sub">{{ fmtDate(h.created_at) }} · {{ t('{n} 道菜', { n: h.item_count }) }}<text v-if="h.calorie_limit">{{ t(' · 上限 {n} kcal', { n: h.calorie_limit }) }}</text></text>
        </view>
        <text class="del-link" @tap.stop="delHistory(h)" aria-role="button">{{ t('删除') }}</text>
      </view>
      <view v-if="shownHistory.length < historyTotal" class="load-more">
        <text class="more-link" @tap="showMoreHistory" aria-role="button">{{ t('加载更多（{a}/{b}）', { a: shownHistory.length, b: historyTotal }) }}</text>
      </view>
      <!-- 审计 B3：这些计划是历史记录，用户要有权清掉；只保留被用餐记录引用过的 -->
      <view v-if="historyTotal > 0" class="clear-all">
        <text class="clear-hint">{{ t('计划只是当时的推荐，删除不影响用餐记录。被记录引用过的会保留。') }}</text>
        <text class="clear-all-link" @tap="clearAllHistory" aria-role="button">{{ t('清空历史计划（{n} 条）', { n: historyTotal }) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
// 审计 B7：动效开关。系统「减弱动态效果」由 CSS 的 prefers-reduced-motion 兜住，
// 这里再给一个应用内开关 —— 有些人不改系统设置，但确实会被闪动影响。
const noAnim = ref(false)
function syncNoAnim() {
  try {
    noAnim.value = uni.getStorageSync('noAnim') === true
  } catch {
    noAnim.value = false
  }
}
syncNoAnim()

import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { errMsg, fmtDate, fmtMoney, zh } from '../../common/util.js'
import { t, tGoalNote, useLocale } from '../../common/i18n.js'

// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('餐前推荐')

const STEP = 20

const budget = ref('80')
const calorieMin = ref('')
const calorieMax = ref('')
const kidMode = ref(false)

// 预算快捷档：2026-11-13 的问卷（29 份）里人均消费是 ¥50–79 占 51.72%、
// ¥80–120 占 34.48%、Over ¥120 占 13.79%，Below ¥50 一个人都没有。
// 所以这里只给这三档，不再放 ¥50 以下。
const budgetPresets = [
  { label: '¥60', value: 60 },
  { label: '¥80', value: 80 },
  { label: '¥120', value: 120 },
]

// 常用热量区间：一档饭量一个，点了直接填进两个框
const calPresets = [
  { label: '轻食 300–500', min: 300, max: 500 },
  { label: '正常 500–700', min: 500, max: 700 },
  { label: '吃饱 700–900', min: 700, max: 900 },
  { label: '大份 900–1200', min: 900, max: 1200 },
]

function pickRange(p) {
  calorieMin.value = String(p.min)
  calorieMax.value = String(p.max)
}

function clearRange() {
  calorieMin.value = ''
  calorieMax.value = ''
}

// 健康目标：问卷第 3 题第 21 条（英文长答）原话是「按减重、控糖、轻食这些不同需求分组给套餐」。
// 我们手上能用的信号只有 18 个食物标签和 calories，没有糖分、蛋白质、钠，
// 所以每一档都只做两件事：套一个默认热量区间、排掉一个标签集。全部是推断，不是营养学。
const goalOptions = [
  { key: '', label: '不限', hint: '' },
  {
    key: 'weight_loss',
    label: '减重',
    min: 500,
    max: 700,
    hint: '套 500–700 kcal 并排掉油炸（库里标了「油炸」的 18 个菜品）。减重的关键在总热量，不在「不碰油」，所以这是保守做法。',
  },
  {
    key: 'blood_sugar',
    label: '控糖',
    min: 400,
    max: 600,
    hint: '套 400–600 kcal 并排掉甜味（库里标了「甜」的 5 道）。⚠ 这里只有甜味标签，没有糖分数据 —— 咸味菜里的隐形糖判不出来，糖尿病人请以店家与医生为准。',
  },
  {
    key: 'light',
    label: '轻食',
    min: 300,
    max: 500,
    hint: '套 300–500 kcal 并排掉油炸。比「减重」更轻的一档，适合只想吃少一点的时候。',
  },
]
const goal = ref('')
const goalHint = computed(() => {
  const g = goalOptions.find((x) => x.key === goal.value)
  return g ? t(g.hint) : ''
})

// 选目标时把热量区间一并套上（后端在用户没填区间时也会套一次，
// 这里同步是为了让人在界面上看得见改了哪两个数，而不是暗中生效）
function pickGoal(g) {
  goal.value = g.key
  if (g.min && g.max) {
    calorieMin.value = String(g.min)
    calorieMax.value = String(g.max)
  } else {
    calorieMin.value = ''
    calorieMax.value = ''
  }
}

const loading = ref(false)
const error = ref('')
const plan = ref(null)
// 三套对比：dryRun 算出来的方案只放在这里，点「用这套」才真落库
const variants = ref(null)
// 三套结果完全一样时（典型场景：没填热量上限）给个提示，别让人以为按钮坏了
const variantSpread = computed(() => {
  const list = (variants.value || []).filter((v) => v.ok && v.plan)
  if (list.length < 2) return 'none'
  const sig = list.map((v) => v.plan.items.map((i) => i.dishId + 'x' + i.quantity).sort().join(',') + '|' + v.plan.estimatedPrice)
  return sig.every((s) => s === sig[0]) ? 'same' : 'diff'
})

const history = ref([])
const historyTotal = ref(0)
// 分页已经挪到服务端（GET /api/plans?limit=&offset=），这里不再做本地切片
const shownHistory = computed(() => history.value)

async function generate() {
  error.value = ''
  plan.value = null
  const b = Number(budget.value)
  if (!b || b <= 0) return uni.showToast({ title: t('请输入预算'), icon: 'none' })
  loading.value = true
  try {
    plan.value = await api.post('/api/plans/generate', {
      budget: b,
      calorieLimit: calorieMax.value === '' ? null : Number(calorieMax.value),
      calorieMin: calorieMin.value === '' ? null : Number(calorieMin.value),
      kidMode: kidMode.value,
      goal: goal.value || null,
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

// 三套对比：只算不存（后端 dryRun），挑中哪套再真生成
async function compare() {
  error.value = ''
  variants.value = null
  const b = Number(budget.value)
  if (!b || b <= 0) return uni.showToast({ title: t('请输入预算'), icon: 'none' })
  loading.value = true
  try {
    const d = await api.post('/api/plans/suggest', {
      budget: b,
      calorieLimit: calorieMax.value === '' ? null : Number(calorieMax.value),
      calorieMin: calorieMin.value === '' ? null : Number(calorieMin.value),
      kidMode: kidMode.value,
      goal: goal.value || null,
    })
    variants.value = d.variants || []
    if (!d.variants || !d.variants.some((v) => v.ok)) error.value = t('这三套在当前预算下都排不出来')
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
}

// 三套一模一样时的那颗按钮：套上「正常 500–700」这个预设，再重新比一次。
// 之所以不再默认替用户填，是因为热量区间是用户的决定，不能悄悄改掉输入。
async function fillRangeAndCompare() {
  const p = calPresets.find((x) => x.min === 500 && x.max === 700)
  if (p) pickRange(p)
  await compare()
}

async function useVariant(v) {
  if (!v || !v.ok) return
  error.value = ''
  loading.value = true
  try {
    plan.value = await api.post('/api/plans/generate', {
      budget: Number(budget.value),
      calorieLimit: calorieMax.value === '' ? null : Number(calorieMax.value),
      calorieMin: calorieMin.value === '' ? null : Number(calorieMin.value),
      strategy: v.key,
      kidMode: kidMode.value,
      goal: goal.value || null,
    })
    variants.value = null
    loadHistory()
    uni.showToast({ title: t('已生成「{l}」计划', { l: t(v.label) }), icon: 'none' })
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loading.value = false
  }
}

async function loadHistory(reset = true) {
  try {
    const offset = reset ? 0 : history.value.length
    const d = await api.get('/api/plans?limit=' + STEP + '&offset=' + offset)
    const list = d.plans || []
    history.value = reset ? list : history.value.concat(list)
    // 老后端没有 total 字段时退化成「已经拿到的条数」，不会显示错误的更多
    historyTotal.value = d.total != null ? d.total : history.value.length
  } catch (e) {
    /* 历史拉取失败不打断主流程 */
  }
}

function showMoreHistory() {
  loadHistory(false)
}

/** 删除单条历史计划（审计 B3） */
async function delHistory(h) {
  const ok = await new Promise((resolve) => {
    uni.showModal({
      title: t('删除这个计划'),
      content: t('预算 ¥{a} · {b}。删了找不回来，但用餐记录不受影响。', { a: fmtMoney(h.budget), b: fmtDate(h.created_at) }),
      cancelText: t('取消'),
      confirmText: t('删除'),
      confirmColor: '#c0392f',
      success: (r) => resolve(r.confirm),
    })
  })
  if (!ok) return
  try {
    await api.del('/api/plans/' + h.id)
    uni.showToast({ title: t('已删除'), icon: 'none' })
    await loadHistory()
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

/** 清空历史计划（审计 B3）。被用餐记录引用过的后端会保留。 */
async function clearAllHistory() {
  const ok = await new Promise((resolve) => {
    uni.showModal({
      title: t('清空历史计划'),
      content: t('会删掉 {n} 条计划。被用餐记录引用过的会保留，用餐记录本身一条都不会动。', { n: historyTotal.value }),
      cancelText: t('取消'),
      confirmText: t('清空'),
      confirmColor: '#c0392f',
      success: (r) => resolve(r.confirm),
    })
  })
  if (!ok) return
  try {
    const d = await api.del('/api/plans')
    uni.showToast({ title: t('已清空 {n} 条', { n: d.cleared || 0 }), icon: 'none' })
    await loadHistory()
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
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
.total-num { display: block; font-size: 40rpx; font-weight: 700; color: #c0392f; }
.item-row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.item-row:last-child { border-bottom: none; }
.price { color: #c0392f; font-weight: 600; }
.clear-link { color: #2563a8; font-size: 24rpx; }
.del-link { font-size: 24rpx; color: #c0392f; padding: 8rpx 0 8rpx 20rpx; }
.clear-all { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #f1f2f5; }
.clear-hint { display: block; font-size: 23rpx; color: #6b7280; line-height: 1.6; }
.clear-all-link { display: block; margin-top: 12rpx; font-size: 24rpx; color: #c0392f; }
.h-title { display: block; font-size: 27rpx; font-weight: 600; }
.h-sub { display: block; margin-top: 6rpx; }
.load-more { text-align: center; padding: 16rpx 0 8rpx; }
.more-link { color: #2563a8; font-size: 26rpx; }

/* 热量区间输入 */
.range-row { display: flex; align-items: center; }
.range-in { flex: 1; text-align: center; }
.range-dash { padding: 0 16rpx; color: #6b7280; }
.range-unit { margin-left: 16rpx; font-size: 24rpx; }

/* 区间快捷选择 */
.chips { display: flex; flex-wrap: wrap; margin-top: 16rpx; }
.chip-sm {
  font-size: 23rpx; color: #5b6470; background: #f2f3f6;
  border-radius: 999rpx; padding: 8rpx 20rpx; margin: 0 12rpx 12rpx 0;
}
.chip-sm-on { background: #fdeaea; color: #c0392f; font-weight: 600; }

/* 热量达标率 */
.fill { margin: 4rpx 0 18rpx; }
.fill-bar { height: 12rpx; background: #f1f2f5; border-radius: 999rpx; overflow: hidden; }
.fill-in { height: 100%; background: #c0392f; border-radius: 999rpx; transition: width .3s ease; }
.fill-text { display: block; margin-top: 12rpx; font-size: 23rpx; }
.fill-warn { display: block; margin-top: 8rpx; font-size: 23rpx; color: #8a5228; }

/* 三套方案对比 */
.va-card {
  border: 1rpx solid #e6e2d8; border-radius: 16rpx;
  padding: 20rpx; margin-bottom: 16rpx;
}
/* 三套算出同一个结果时的提示（不填热量上限就会这样） */
.same-note {
  background: #fdf6ec; border: 1rpx solid #f0dcc0; border-radius: 12rpx;
  padding: 16rpx 18rpx; margin-bottom: 14rpx;
}
.same-text { display: block; font-size: 23rpx; line-height: 1.55; color: #8a6a3b; }
.same-btn {
  display: inline-block; margin-top: 10rpx; font-size: 23rpx;
  color: #c0392f; text-decoration: underline;
}
.va-off { opacity: .55; }
.va-title { font-weight: 600; font-size: 30rpx; }
.va-price { font-weight: 600; font-size: 30rpx; color: #c0392f; }
.va-hint { display: block; font-size: 23rpx; margin-top: 4rpx; }
.va-meta { display: block; font-size: 23rpx; margin-top: 10rpx; }
.va-items { display: flex; flex-wrap: wrap; margin-top: 6rpx; }
.va-item {
  font-size: 23rpx; color: #454b54; background: #f5f3ec;
  border-radius: 8rpx; padding: 4rpx 14rpx; margin: 6rpx 10rpx 0 0;
}
.va-btn { margin-top: 18rpx; }

/* 结果卡上的健康目标说明：把「按什么排的」摊开，而不是让用户以为这是营养学判定 */
.goal-box {
  background: #f7f7f5; border: 1rpx solid #e6e4dd; border-radius: 12rpx;
  padding: 16rpx 18rpx; margin-top: 20rpx;
}
.goal-title { display: block; font-size: 25rpx; font-weight: 600; color: #2f333a; }
.goal-note { display: block; font-size: 24rpx; line-height: 1.55; margin-top: 6rpx; }
.goal-warn { display: block; font-size: 24rpx; line-height: 1.55; margin-top: 8rpx; color: #8a5228; }

/* 儿童模式开关 */
.sw {
  width: 88rpx; height: 48rpx; border-radius: 999rpx;
  background: #dcdfe6; position: relative; transition: background .2s ease;
}
.sw-on { background: #c0392f; }
.sw-dot {
  position: absolute; top: 4rpx; left: 4rpx;
  width: 40rpx; height: 40rpx; border-radius: 50%;
  background: #fff; transition: transform .2s ease;
}
.sw-on .sw-dot { transform: translateX(40rpx); }
</style>
