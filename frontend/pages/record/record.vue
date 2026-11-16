<template>
  <view class="page record-page">
    <view class="card" v-if="plan">
      <text class="muted">{{ t('来自推荐计划 · 预算 ¥{b}', { b: fmtMoney(plan.budget) }) }}<text v-if="plan.calorie_limit">{{ t(' · 热量上限 {n} kcal', { n: plan.calorie_limit }) }}</text></text>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">{{ t('本次菜品') }}</text>
        <view class="btn btn-sm btn-ghost" @tap="openPicker" aria-role="button">{{ t('＋ 添加菜品') }}</view>
      </view>
      <view v-if="!items.length" class="empty">{{ t('还没有菜品，点右上角添加，或用下方拍照识别') }}</view>
      <view v-for="(it, idx) in items" :key="idx" class="item">
        <view class="flex1">
          <view class="row">
            <text class="item-name">{{ zh(it.dishName) }}</text>
            <text
              v-if="dishHitsOf(dishOf(it)).length"
              :class="['risk-tag', dishHitsOf(dishOf(it))[0].kind === 'allergy' ? 'risk-danger' : 'risk-warn']"
            >{{ dishHitsOf(dishOf(it)).map((h) => h.name).join('/') }}</text>
          </view>
          <text class="muted item-sub">¥{{ fmtMoney(it.unitPrice) }}<text v-if="it.unitCalories != null"> · {{ it.unitCalories }} kcal</text></text>
        </view>
        <view class="qty">
          <view class="qty-btn" @tap="changeQty(idx, -1)" aria-role="button">－</view>
          <text class="qty-num">{{ it.quantity }}</text>
          <view class="qty-btn" @tap="changeQty(idx, 1)" aria-role="button">＋</view>
        </view>
        <text class="del" @tap="removeItem(idx)" aria-role="button">{{ t('删除') }}</text>
      </view>
      <view class="divider"></view>
      <view class="row between">
        <text class="muted">{{ t('菜单价估算') }}</text>
        <text class="price">¥{{ estimatePrice }}</text>
      </view>
      <view class="row between" style="margin-top: 8rpx">
        <text class="muted">{{ t('热量估算') }}</text>
        <text class="price">{{ estimateCalories }} kcal</text>
      </view>
    </view>

    <!-- 点单提示：过敏/忌口命中 + 这一单可能含有的过敏原 -->
    <view v-if="items.length" class="card tip-card">
      <view class="row between">
        <text class="section-title">{{ t('用餐提示') }}</text>
        <text v-if="allergyHits.length" class="tip-badge tip-danger">{{ t('{n} 项过敏', { n: allergyHits.length }) }}</text>
        <text v-else-if="nutritionRisk.length" class="tip-badge tip-danger">{{ t('{n} 项存疑', { n: nutritionRisk.length }) }}</text>
        <text v-else-if="avoidHits.length" class="tip-badge tip-warn">{{ t('{n} 项忌口', { n: avoidHits.length }) }}</text>
        <text v-else-if="noRiskAtAll" class="tip-badge tip-ok">{{ t('未命中') }}</text>
      </view>

      <view v-if="hits.length" class="tip-list">
        <view v-for="(h, i) in hits" :key="i" class="tip-row">
          <text :class="['tip-dot', h.kind === 'allergy' ? 'dot-danger' : 'dot-warn']">●</text>
          <text class="tip-text">{{ t('{d} 含「{t}」（{k}）', { d: h.dishName, t: h.tagName, k: h.kind === 'allergy' ? t('过敏') : t('忌口') }) }}</text>
        </view>
      </view>
      <!-- 中文标签没命中、但日文过敏原清单里有 —— 单独说，别混进上面那条 -->
      <view v-if="nutritionRisk.length" class="tip-list">
        <view v-for="(a, i) in nutritionRisk" :key="'n' + i" class="tip-row">
          <text class="tip-dot dot-danger">●</text>
          <text class="tip-text">{{ t('这一单里的菜被标注含「{a}」，和你设置的过敏项同名 —— 中文标签没标，所以上面查不到。', { a: a.label }) }}</text>
        </view>
        <text class="muted tip-none">{{ t('这条是按菜品的日本 28 品目过敏原数据查的，比中文标签全；宁可多提醒一次。') }}</text>
      </view>
      <text v-else-if="noRiskAtAll" class="muted tip-none">
        {{ t('已选 {n} 道，都没有命中你设置的忌口与过敏项。', { n: items.length }) }}
      </text>

      <view v-if="orderAllergens.length" class="allergen-box">
        <text class="allergen-title">{{ t('这一单可能含有（日本 28 品目推断）') }}</text>
        <view class="tag-wrap">
          <text v-for="a in orderAllergens" :key="a.token" class="tag tag-allergen">{{ aEn(a.label) }}</text>
        </view>
        <text class="muted allergen-note">{{ t('过敏原由菜品配料推断，不是店家标注；对某样严重过敏请以店员确认为准。') }}</text>
      </view>

      <view v-if="planGap" class="plan-gap">
        <text v-if="planGap.hasBudget" :class="['gap-line', planGap.overPrice ? 'dot-danger' : 'gap-ok']">
          {{ planGap.overPrice ? t('⚠ 已超出计划预算 ¥{x}', { x: fmtMoney(planGap.dPrice) }) : t('✓ 在计划预算内') }}
        </text>
        <text v-if="planGap.hasLimit" :class="['gap-line', planGap.overCal ? 'dot-danger' : 'gap-ok']">
          {{ planGap.overCal ? t('⚠ 已超出热量上限 {n} kcal', { n: Math.round(planGap.dCal) }) : t('✓ 在热量上限内') }}
        </text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">{{ t('账单与评分') }}</text>
      <view class="field">
        <text class="label">{{ t('用餐人数') }}</text>
        <view class="stepper">
          <text class="step-btn" :class="{ 'step-off': diners <= 1 }" @tap="diners = Math.max(1, diners - 1)" aria-role="button">－</text>
          <text class="step-num">{{ t('{n} 人', { n: diners }) }}</text>
          <text class="step-btn" :class="{ 'step-off': diners >= 12 }" @tap="diners = Math.min(12, diners + 1)">＋</text>
        </view>
        <text v-if="perHead" class="muted field-tip">
          {{ t('按 {n} 人拆计划：人均预算', { n: diners }) }}
          <text v-if="perHead.budget != null">¥{{ fmtMoney(perHead.budget) }}</text>
          <text v-if="perHead.budget != null && perHead.kcal != null"> · </text>
          <text v-if="perHead.kcal != null">{{ t('人均热量 {n} kcal', { n: Math.round(perHead.kcal) }) }}</text>
        </text>
      </view>
      <view class="field">
        <text class="label">{{ t('茶位费 / 服务费（每位，元）') }}</text>
        <input class="input" type="digit" v-model="teaFee" :placeholder="t('不清楚就留空')" />
        <text class="muted field-tip">
          {{ t('这家店收不收茶位费我们没有依据，所以默认 0 —— 按实际小票填，填了才会算进下面的合计，不会自动给账单加钱。') }}
        </text>
      </view>
      <view class="field">
        <text class="label">{{ t('账单实付（元）') }}</text>
        <input class="input" type="digit" v-model="actualPaid" :placeholder="t('例如 76')" />
        <text v-if="feeTotal > 0" class="muted field-tip">
          {{ t('菜品 ¥{a} + 茶位费 ¥{b}（{n} 人 × ¥{c}）', { a: fmtMoney(dishTotal), b: fmtMoney(feeTotal), n: diners, c: fmtMoney(teaFee) }) }}
          = <text style="color: #8a5228">¥{{ fmtMoney(paySuggest) }}</text>
          <text @tap="actualPaid = String(paySuggest)" style="color: #4f6288; margin-left: 12rpx" aria-role="button">{{ t('填入') }}</text>
        </text>
      </view>
      <view class="field">
        <text class="label">{{ t('自评（1-5 星）') }}</text>
        <view class="stars">
          <text v-for="i in 5" :key="i" class="star" @tap="rating = i" aria-role="button">{{ i <= rating ? '★' : '☆' }}</text>
        </view>
      </view>
      <view class="field">
        <text class="label">{{ t('短评') }}</text>
        <textarea class="input-area" v-model="comment" :placeholder="t('这顿吃得怎么样？')" :maxlength="200" />
      </view>
    </view>

    <view class="card">
      <text class="section-title">{{ t('照片识别（演示）') }}</text>
      <text class="muted">{{ t('上传账单或菜品照片后，系统会加入一份草稿，你可以自由修改。') }}</text>
      <text class="muted" style="display: block; margin-top: 10rpx; color: #8a5228">
        {{ t('当前版本尚未接入真实 OCR：草稿是从在售菜品里随机取的示例数据，不是从照片里读出来的。') }}
      </text>
      <view class="row" style="margin-top: 20rpx">
        <view class="btn btn-sm btn-ghost" @tap="pickImage('bill')" aria-role="button">{{ t('上传账单照片') }}</view>
        <view class="btn btn-sm btn-ghost" style="margin-left: 16rpx" @tap="pickImage('dish')" aria-role="button">{{ t('上传菜品照片') }}</view>
      </view>
      <text v-if="uploadIds.length" class="muted" style="display: block; margin-top: 14rpx">{{ t('已上传 {n} 张图片', { n: uploadIds.length }) }}</text>
      <text v-if="demoUsed" class="muted" style="display: block; margin-top: 10rpx; color: #8a5228">
        {{ t('已加入的菜品标记为 source=mock —— 演示数据，请逐条核对或删除。') }}
      </text>
    </view>

    <view v-if="result" class="card result-card">
      <text class="muted">{{ t('本次用餐评级') }}</text>
      <text class="tier" :style="{ color: tierColor(result.evaluation.tierKey) }">{{ result.evaluation.tierLabel }}</text>
      <text class="muted">{{ t('综合得分 {n} 分', { n: result.evaluation.score }) }}</text>
      <view class="basis">
        <text class="basis-line">{{ t('预算：{x}', { x: budgetText(result.evaluation.basis) }) }}</text>
        <text class="basis-line">{{ t('热量：{x}', { x: calorieText(result.evaluation.basis) }) }}</text>
        <text class="basis-line">{{ t('口味匹配：{n}%', { n: pct(result.evaluation.basis.prefRatio) }) }}</text>
      </view>
      <view v-if="result.badges && result.badges.length" class="new-badges">
        <text class="muted">{{ t('🎉 新获得勋章：') }}</text>
        <text v-for="bd in result.badges" :key="bd.id" class="tag">{{ badgeLabel(bd.name) }}</text>
      </view>
      <button class="btn btn-primary" style="margin-top: 20rpx" @tap="goHistory">{{ t('查看用餐历史') }}</button>
    </view>

    <view class="footer">
      <view class="btn btn-ghost" style="flex: 1; margin-right: 16rpx" @tap="saveDraft" aria-role="button">{{ t('保存草稿') }}</view>
      <view class="btn btn-primary" style="flex: 1" :class="{ disabled: confirmed }" @tap="confirmMeal" aria-role="button">
        {{ confirmed ? t('已确认') : t('确认用餐') }}
      </view>
    </view>

    <!-- 菜品选择：改用可搜索弹层，替代原先把 270 道菜塞进 picker 的做法 -->
    <view v-if="pickerOpen" class="mask" @tap="pickerOpen = false" aria-role="button">
      <view class="sheet" @tap.stop aria-role="button">
        <view class="row between">
          <text class="section-title">{{ t('选择菜品（{n}）', { n: pickerList.length }) }}</text>
          <text class="muted" @tap="pickerOpen = false" aria-role="button">{{ t('关闭 ✕') }}</text>
        </view>
        <input
          class="input"
          v-model="pickerSearch"
          :placeholder="t('搜索菜名，如 三文鱼')"
          confirm-type="search"
          style="margin-bottom: 16rpx"
        />
        <scroll-view scroll-y class="picker-list" @scrolltolower="loadMorePicker">
          <view v-if="!pickerList.length" class="empty">{{ t('没有匹配的菜品') }}</view>
          <view v-for="d in pickerList" :key="d.id" class="picker-row" @tap="pickDish(d)" aria-role="button">
            <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="picker-thumb" lazy-load />
            <view class="flex1">
              <view class="row">
                <text class="item-name">{{ zh(d.name) }}</text>
                <text
                  v-if="dishHitsOf(d).length"
                  :class="['risk-tag', dishHitsOf(d)[0].kind === 'allergy' ? 'risk-danger' : 'risk-warn']"
                >{{ dishHitsOf(d).map((h) => tagLabel(h.name)).join('/') }}</text>
              </view>
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
import { errMsg, fmtMoney, pct, zh } from '../../common/util.js'
import { avoidMapFrom, canonAllergen, dishHits, mergeAllergens } from '../../common/allergens.js'
import { locale, t, useLocale } from '../../common/i18n.js'
import { allergenEn, badgeLabel, tagLabel } from '../../common/i18nData.js'

// 过敏原中文名 → 英文（英文模式下才有区别）
function aEn(zhName) {
  return locale.value === 'en' ? allergenEn(zhName) : zhName
}

// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('餐后记录')

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
  // 选择弹层里按菜名去重：库里 78 组同名重复（只有分类不同），不去重会看到同一道菜两行。
  // 注意 dishes 本身保留全量 —— 点单卡判断忌口/过敏要靠 dishId 反查，去重了会查不到。
  const seen = new Set()
  const uniq = []
  for (const d of base) {
    if (seen.has(d.name)) continue
    seen.add(d.name)
    uniq.push(d)
  }
  return uniq.slice(0, pickerLimit.value)
})

const estimatePrice = computed(() =>
  items.value.reduce((s, it) => s + (Number(it.unitPrice) || 0) * it.quantity, 0).toFixed(1)
)
const estimateCalories = computed(() =>
  items.value.reduce((s, it) => s + (it.unitCalories != null ? Number(it.unitCalories) : 0) * it.quantity, 0)
)

// ---- 点单提示：这一单碰没碰到你自己的忌口/过敏 ----
// 判据有两套，各说各的：
//   · 偏好词表（tags，中文）：点单卡命中「忌口/过敏」的那几道菜 —— 这是能指名道姓的警告；
//   · 过敏原词表（dish_nutrition.allergen_list，日文）：菜品实际含有的 28 品目 token ——
//     这是「可能含有」清单，用户自己能核。
// 两套互不相通，所以两个都显示，不互相替代。
const prefs = ref([])
const avoidMap = computed(() => avoidMapFrom(prefs.value))
const dishById = computed(() => {
  const m = new Map()
  for (const d of dishes.value) m.set(d.id, d)
  return m
})
const dishOf = (it) => (it && it.dishId != null ? dishById.value.get(Number(it.dishId)) : null)

// 命中忌口/过敏的菜（去重：同一道菜多点两份只提示一次）
const hits = computed(() => {
  const out = []
  const seen = new Set()
  for (const it of items.value) {
    const d = dishOf(it)
    const key = d ? d.id : 'name:' + it.dishName
    if (seen.has(key)) continue
    seen.add(key)
    for (const h of dishHits(d, avoidMap.value)) {
      out.push({ dishName: zh((d && d.name) || it.dishName), tagName: tagLabel(h.name), kind: h.kind })
    }
  }
  return out
})
const allergyHits = computed(() => hits.value.filter((h) => h.kind === 'allergy'))
const avoidHits = computed(() => hits.value.filter((h) => h.kind === 'avoid'))
// 这一单「可能含有」的过敏原（并集，按命中菜品数排序）
const orderAllergens = computed(() =>
  mergeAllergens(items.value.map((it) => dishOf(it)).filter(Boolean))
)

// 用户的过敏项（中文名），例如「乳制品」。
// 用来把上面两张表对起来 —— 审计 A2 的根因就在这里：
// 中文标签只有 18 个、日文过敏原 28 品目，同一道菜两边常常只有一边标了。
// 在售 269 道里日文含乳的 27 道、中文也标了乳制品的只有 17 道，
// 所以「忌口命中」判绿、下面「可能含有：乳制品」同时出现，是真的会发生的。
const allergyTagNames = computed(() =>
  (prefs.value || []).filter((t) => t.preference === 'allergy').map((t) => String(t.name || ''))
)

// 用户过敏项里，有哪些被「这一单」的日文过敏原清单命中（哪怕中文标签没标）
const nutritionRisk = computed(() => {
  const names = allergyTagNames.value.map(canonAllergen).filter(Boolean)
  if (!names.length) return []
  const out = []
  for (const a of orderAllergens.value) {
    if (names.indexOf(canonAllergen(a.label)) >= 0) out.push(a)
  }
  return out
})

// 文案上区分三种情况，避免「未命中」的绿标盖住真实风险：
//   · 中文标签直接命中      → hits / allergyHits（能指名道姓）
//   · 只有日文过敏原命中    → nutritionRisk（只能说「可能含有」）
//   · 两边都没命中          → 才给绿标
const noRiskAtAll = computed(
  () => canJudge.value && hits.value.length === 0 && nutritionRisk.value.length === 0
)
// 菜品池没拉到时无法判断命中，这时不显示「未命中」的安心文案，免得误报
const canJudge = computed(() => dishes.value.length > 0)

function dishHitsOf(d) { return dishHits(d, avoidMap.value) }

// 这一单和「来自推荐计划」的预算/热量上限比，超了就在点单卡上直说
const planGap = computed(() => {
  if (!plan.value) return null
  const b = Number(plan.value.budget) || 0
  const cl = Number(plan.value.calorie_limit) || 0
  const dPrice = Number(estimatePrice.value) - b
  const dCal = estimateCalories.value - cl
  if (b <= 0 && cl <= 0) return null
  return {
    overPrice: b > 0 && dPrice > 0,
    overCal: cl > 0 && dCal > 0,
    dPrice,
    dCal,
    hasBudget: b > 0,
    hasLimit: cl > 0,
  }
})

function tierColor(t) { return TIER_COLOR[t] || '#6b7280' }
function toast(t) { uni.showToast({ title: String(t || ''), icon: 'none' }) }

// ——— 用餐人数与茶位费 ———
// 本店是否收茶位费/服务费我们没有依据，所以默认 0，由用户按结账小票自己填；
// 这里只做「人头 × 每位费用」的算术与人均拆分，绝不擅自给账单加钱。
const diners = ref(1)
const teaFee = ref('')
const feeTotal = computed(() => {
  const f = Number(teaFee.value)
  if (!Number.isFinite(f) || f <= 0) return 0
  return f * diners.value
})
const dishTotal = computed(() => Number(estimatePrice.value) || 0)
const paySuggest = computed(() => dishTotal.value + feeTotal.value)
// 计划是按「这一桌」定的，人数 >1 时顺手拆一份人均口径给用户对
const perHead = computed(() => {
  if (!plan.value || diners.value <= 1) return null
  const b = Number(plan.value.budget) || 0
  const cl = Number(plan.value.calorie_limit) || 0
  if (b <= 0 && cl <= 0) return null
  return {
    budget: b > 0 ? b / diners.value : null,
    kcal: cl > 0 ? cl / diners.value : null,
  }
})

function budgetText(b) {
  if (!b || b.budgetMet == null) return t('未设置计划')
  if (b.budgetMet) return t('达成 ✓')
  return t('超支 {x} 元', { x: fmtMoney(b.budgetDelta) })
}
function calorieText(b) {
  if (!b || b.calorieMet == null) return t('未设置上限')
  return b.calorieMet ? t('达成 ✓') : t('超出')
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
    toast(t('已保存草稿'))
  } catch (e) {
    toast(errMsg(e))
  }
}

async function confirmMeal() {
  if (!items.value.length) return toast(t('请先添加菜品'))
  try {
    await ensureSaved()
    const r = await api.post('/api/meals/' + mealId.value + '/confirm')
    result.value = r
    confirmed.value = true
    toast(t('已确认用餐'))
  } catch (e) {
    toast(errMsg(e))
  }
}

function pickImage(type) {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      try {
        uni.showLoading({ title: t('生成草稿…') })
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
        toast(added ? t('已加入 {n} 条演示草稿，请核对后修改', { n: added }) : t('没有可加入的草稿'))
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
    // 菜品池同时供两处用：选择弹层，以及点单卡的忌口/过敏命中判断
    const data = await api.get('/api/dishes?status=on_sale')
    dishes.value = data.dishes || []
  } catch (e) {
    /* 菜品池拉取失败时仍可手动保存草稿 */
  }
  try {
    // 只取用户自己的忌口/过敏（like/dislike 与风险无关，进去也会被 avoidMapFrom 滤掉）
    const pref = await api.get('/api/user/preferences')
    prefs.value = pref.tags || []
  } catch (e) {
    /* 拉不到偏好就不显示命中提示，不影响下单 */
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
.del { color: #c0392f; font-size: 24rpx; }
.price { color: #c0392f; font-weight: 600; }
.stars { display: flex; }
.star { font-size: 52rpx; color: #c47f00; margin-right: 12rpx; }
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
.add-txt { color: #c0392f; font-size: 40rpx; font-weight: 700; padding: 0 10rpx; }

/* 点单提示：过敏/忌口 */
.tip-card { border-left: 6rpx solid #f1f2f5; }
.tip-badge { font-size: 24rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.tip-danger { background: #fdeaea; color: #c0392f; }
.tip-warn { background: #fff4e6; color: #b4460a; }
.tip-ok { background: #eaf7ee; color: #1f7a33; }
.tip-list { margin-top: 14rpx; }
.tip-row { display: flex; align-items: flex-start; margin-bottom: 8rpx; }
.tip-dot { font-size: 24rpx; line-height: 1.7; margin-right: 10rpx; }
.dot-danger { color: #c0392f; }
.dot-warn { color: #b4460a; }
.tip-text { flex: 1; font-size: 26rpx; color: #333; line-height: 1.7; }
.tip-none { display: block; margin-top: 12rpx; }
.risk-tag {
  font-size: 24rpx; padding: 2rpx 10rpx; border-radius: 6rpx;
  margin-left: 12rpx; line-height: 1.6;
}
.risk-danger { background: #fdeaea; color: #c0392f; border: 1rpx solid #f5b5b2; }
.risk-warn { background: #fff4e6; color: #b4460a; border: 1rpx solid #f7c99b; }
.allergen-box { margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid #f1f2f5; }
.allergen-title { display: block; font-size: 24rpx; color: #5b6470; margin-bottom: 12rpx; }
.tag-wrap { display: flex; flex-wrap: wrap; }
.tag-allergen { background: #f1f2f5; color: #5b6470; margin: 0 12rpx 12rpx 0; }
.allergen-note { display: block; margin-top: 6rpx; font-size: 24rpx; line-height: 1.6; }
.plan-gap { margin-top: 12rpx; }
.gap-line { display: block; font-size: 26rpx; line-height: 1.8; }
.gap-ok { color: #1f7a33; }

/* 用餐人数与茶位费 */
.stepper { display: flex; align-items: center; }
.step-btn {
  width: 64rpx; height: 64rpx; line-height: 64rpx; text-align: center;
  border-radius: 12rpx; background: #f2f3f6; color: #454b54; font-size: 34rpx;
}
.step-num { min-width: 120rpx; text-align: center; font-size: 30rpx; }
.step-off { opacity: .4; }
.field-tip { display: block; margin-top: 8rpx; font-size: 24rpx; line-height: 1.6; }
</style>
