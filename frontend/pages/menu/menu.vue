<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <input class="input flex1" v-model="search" :placeholder="t('搜索菜品')" confirm-type="search" @confirm="reload" />
        <view class="btn btn-sm btn-primary search-btn" @tap="reload" aria-role="button">{{ t('搜索') }}</view>
      </view>
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view :class="['chip', categoryId === 0 ? 'active' : '']" @tap="setCategory(0)" aria-role="button">{{ t('全部') }}</view>
        <view
          v-for="c in categories"
          :key="c.id"
          :class="['chip', categoryId === c.id ? 'active' : '']"
          @tap="setCategory(c.id)" aria-role="button"
        >{{ c.label || catLabel(c.name) }}</view>
      </scroll-view>
      <view class="row wrap">
        <view
          v-for="f in statusFilters"
          :key="f.value"
          :class="['chip', status === f.value ? 'active' : '']"
          @tap="setStatus(f.value)" aria-role="button"
        >{{ t(f.label) }}</view>
      </view>
      <view v-if="allergens.length" class="allergen-filter">
        <view class="row between">
          <text class="muted">{{ t('避开过敏原') }}{{ excluded.length ? t('（已排除 {n} 项）', { n: excluded.length }) : '' }}</text>
          <text v-if="excluded.length" class="clear-link" @tap="clearAllergens" aria-role="button">{{ t('清除') }}</text>
        </view>
        <scroll-view scroll-x class="chips" :show-scrollbar="false">
          <view
            v-for="a in allergens"
            :key="a.name"
            :class="['chip', 'chip-sm', excludedSet.has(a.name) ? 'chip-excluded' : '']"
            @tap="toggleAllergen(a.name)" aria-role="button"
          >{{ aEn(a.name, a.label) }} {{ a.count }}</view>
        </scroll-view>
      </view>
    </view>

    <view v-if="loading" class="empty">{{ t('加载中…') }}</view>
    <view v-else-if="loadErr" class="empty">{{ t('连不上后端，请先启动服务后下拉刷新') }}</view>
    <view v-else-if="!dishes.length" class="empty">{{ t('没有找到菜品') }}</view>
    <view v-else class="row between list-head">
      <text class="muted">{{ t('共 {n} 道', { n: total }) }}{{ dishes.length < total ? t('，已显示 {n}', { n: dishes.length }) : '' }}</text>
      <text v-if="excluded.length" class="muted">{{ t('已排除过敏原') }}</text>
    </view>

    <view v-for="d in dishes" :key="d.id" class="card dish" @tap="detail = d" aria-role="button">
      <view class="row between">
        <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="dish-thumb" lazy-load />
        <view class="flex1">
          <view class="row">
            <text class="dish-name">{{ zh(d.name) }}</text>
            <text :class="['pill', 'st-' + d.status]">{{ statusLabel(d.status) }}</text>
          </view>
          <view class="dish-meta muted">
            <text>¥{{ d.price }}</text>
            <!-- 审计 B2：热量是程序推断值，列表上必须标出来；「≈」比只写数字诚实 -->
            <text v-if="kcalOf(d)"> · <text class="approx">≈</text>{{ kcalOf(d) }} kcal</text>
            <text v-if="d.status === 'pending' && d.expected_date">{{ t(' · 预计 {d}', { d: d.expected_date }) }}</text>
          </view>
          <view class="tags">
            <text v-for="tg in d.tags" :key="tg.id" :class="['tag', tg.type === 'flavor' ? 'tag-flavor' : '']">{{ tagLabel(tg.name) }}</text>
            <text
              v-for="a in (d.allergens || [])"
              :key="'al-' + a"
              :class="['tag', 'tag-allergen', excludedSet.has(a) ? 'tag-danger' : '']"
            >{{ aLabel(a) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="dishes.length < total" class="load-more">
      <text class="more-link" @tap="showMore" aria-role="button">{{ loadingMore ? t('加载中…') : t('加载更多（{a}/{b}）', { a: dishes.length, b: total }) }}</text>
    </view>

    <view v-if="detail" class="mask" @tap="detail = null" aria-role="button">
      <view class="sheet" @tap.stop aria-role="button">
        <image v-if="detail.image" :src="BASE_URL + detail.image" mode="aspectFit" class="detail-img" />
        <view class="row between">
          <text class="title">{{ zh(detail.name) }}</text>
          <text class="muted" @tap="detail = null" aria-role="button">{{ t('关闭 ✕') }}</text>
        </view>
        <view class="muted" style="margin: 12rpx 0">
          {{ statusLabel(detail.status) }} · {{ detail.allergen_source ? t('热量/过敏原为推断值') : t('官网未提供营养信息') }}
        </view>
        <view v-if="detail.allergen_source" class="infer-note">
          <text class="infer-note-txt">
            {{ t('热量与过敏原是程序按菜名关键词估出来的，不是官方标示。热量误差可能在 ±20%；过敏原请以店家的配料表为准，吃不准就问店员。') }}
          </text>
        </view>
        <view class="detail-nutrition" v-if="kcalOf(detail)">
          <view class="nut-item">
            <text class="nut-num">≈{{ kcalOf(detail) }}</text>
            <text class="nut-label">{{ t('kcal / {u}', { u: detail.kcal_unit || t('份') }) }}</text>
          </view>
          <view class="nut-item">
            <text class="nut-num">¥{{ detail.price }}</text>
            <text class="nut-label">{{ t('单价') }}</text>
          </view>
        </view>
        <view v-if="detail.allergens && detail.allergens.length" class="allergen-box">
          <text class="allergen-title">{{ t('可能含有（日本28品目推断）') }}</text>
          <view class="tags">
            <text
              v-for="a in detail.allergens"
              :key="'d-' + a"
              :class="['tag', 'tag-allergen', excludedSet.has(a) ? 'tag-danger' : '']"
            >{{ aLabel(a) }}</text>
          </view>
        </view>
        <view class="tags">
          <text v-for="tg in detail.tags" :key="tg.id" class="tag">{{ tagLabel(tg.name) }}</text>
        </view>
        <text class="muted">{{ detail.description || t('暂无描述') }}</text>
        <button class="btn btn-primary" style="margin-top: 24rpx" @tap="recordDish">{{ t('去记录这道菜') }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { STATUS_LABEL, BASE_URL } from '../../common/config.js'
import { errMsg, zh } from '../../common/util.js'
import { allergenLabel } from '../../common/allergens.js'
import { t, locale, useLocale } from '../../common/i18n.js'
import { catLabel, tagLabel, allergenEn } from '../../common/i18nData.js'

// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('寿司菜单')

const PAGE_STEP = 60

const categories = ref([])
const categoryId = ref(0)
// 默认「全部」：与 statusFilters 里「全部」的取值保持一致，否则首屏看不到已下架菜品
const status = ref('on_sale,pending,off_sale')
const statusFilters = [
  { label: '全部', value: 'on_sale,pending,off_sale' },
  { label: '在售', value: 'on_sale' },
  { label: '待上架', value: 'pending' },
  { label: '已下架', value: 'off_sale' },
]
const search = ref('')
const dishes = ref([])
const total = ref(0)
const detail = ref(null)
const loading = ref(false)
const loadingMore = ref(false)
// 加载失败与「真的没有菜品」是两件事：前者要提示用户后端没起来，
// 后者才该说「没有找到菜品」。混在一起会让人以为菜单是空的。
const loadErr = ref(false)
const allergens = ref([])
const excluded = ref([])
const excludedSet = computed(() => new Set(excluded.value))

// 过敏原日文 token → 中文：抽到了 common/allergens.js，点单卡也用同一份
function kcalOf(d) { return d.kcal_estimate != null ? d.kcal_estimate : d.calories }

function toggleAllergen(a) {
  const i = excluded.value.indexOf(a)
  if (i >= 0) excluded.value.splice(i, 1)
  else excluded.value.push(a)
  reload()
}
function clearAllergens() {
  excluded.value = []
  reload()
}

function statusLabel(s) { return t(STATUS_LABEL[s] || s) }

// 分类 chip / 标签 / 过敏原都是数据枚举，英文模式下走 i18nData 的映射表。
// 过敏原 chip 的 a.name 是日文 token，a.label 是后端给的中文名，两个都可能用到。
function aEn(token, zhLabel) {
  const zhName = zhLabel || allergenLabel(token)
  return locale.value === 'en' ? allergenEn(zhName) : zhName
}
function aLabel(token) { return aEn(token, '') }

// 审计修复：dish_categories 里简繁各存一份（甜点 / 甜點），中文是两个词，
// 英文翻译后同名，chip 会重复。英文模式按译文聚合并把多个 id 用逗号拼起来，
// 后端 categoryId 已支持多值。
function mergeCats(list) {
  if (locale.value !== 'en') return list.map((c) => ({ ...c, label: catLabel(c.name) }))
  const m = new Map()
  for (const c of list) {
    const lb = catLabel(c.name)
    const cur = m.get(lb)
    if (cur) cur.id = cur.id + ',' + c.id
    else m.set(lb, { ...c, label: lb })
  }
  return [...m.values()]
}

function setCategory(id) { categoryId.value = id; reload() }
function setStatus(v) { status.value = v; reload() }
function showMore() { loadDishes(true) }
function reload() {
  loadDishes(false)
}

// 后端 2026-11-09 起支持 limit/offset（BUG-6），所以改成真·服务端分页：
// 首屏只取 60 道（原来一次 271 道、135 KB），下拉再取下一页。
async function loadDishes(append) {
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const offset = append ? dishes.value.length : 0
    const params = []
    if (categoryId.value) params.push('categoryId=' + categoryId.value)
    if (status.value) params.push('status=' + encodeURIComponent(status.value))
    if (search.value.trim()) params.push('search=' + encodeURIComponent(search.value.trim()))
    if (excluded.value.length) params.push('excludeAllergen=' + encodeURIComponent(excluded.value.join(',')))
    // 按菜名去重：库里 78 组同名重复（156 道，只有分类不同）会让同一道菜在列表里出现两次。
    // 管理页不带这个参数，那边要看全部 271 行。
    params.push('dedupe=1')
    params.push('limit=' + PAGE_STEP)
    params.push('offset=' + offset)
    const data = await api.get('/api/dishes?' + params.join('&'))
    loadErr.value = false
    const list = data.dishes || []
    dishes.value = append ? dishes.value.concat(list) : list
    // data.total 是符合条件的总数；老版本后端没有这个字段时退化成当前条数
    total.value = data.total != null ? data.total : dishes.value.length
  } catch (e) {
    if (!append) dishes.value = []
    loadErr.value = true
    uni.showToast({ title: errMsg(e), icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadCategories() {
  try {
    const [c, a] = await Promise.all([api.get('/api/categories'), api.get('/api/allergens')])
    categories.value = mergeCats(c.categories || [])
    allergens.value = a.allergens || []
  } catch (e) {
    /* 分类/过敏原失败不阻塞列表 */
  }
}

function recordDish() {
  const id = detail.value.id
  detail.value = null
  uni.navigateTo({ url: '/pages/record/record?dishId=' + id })
}

onShow(() => {
  loadCategories()
  loadDishes(false)
})

onReachBottom(() => {
  if (!loadingMore.value && dishes.value.length < total.value) showMore()
})
</script>

<style scoped>
.search-btn { margin-left: 16rpx; }
.chips { white-space: nowrap; margin: 20rpx 0 10rpx; }
.chip {
  display: inline-block; padding: 10rpx 24rpx; margin: 0 12rpx 8rpx 0;
  border-radius: 999rpx; background: #f1f2f5; color: #5b6470; font-size: 24rpx;
}
.chip.active { background: #c0392f; color: #fff; }
.chip-sm { padding: 8rpx 20rpx; font-size: 24rpx; }
.chip-excluded { background: #fdeaea; color: #c0392f; }
.allergen-filter { margin-top: 8rpx; padding-top: 16rpx; border-top: 1rpx solid #f1f2f5; }
.clear-link { color: #2563a8; font-size: 24rpx; }
.list-head { padding: 0 8rpx 12rpx; }
.dish-thumb {
  width: 160rpx; height: 160rpx; border-radius: 16rpx; margin-right: 20rpx;
  flex-shrink: 0; background: #f1f2f5;
}
.detail-img {
  width: 440rpx; height: 440rpx; max-width: 100%; display: block; margin: 0 auto 20rpx;
  border-radius: 18rpx; background: #f1f2f5;
}
.dish-meta { margin-top: 8rpx; }
.approx { color: #6b7280; }
.infer-note { margin: 4rpx 0 16rpx; padding: 16rpx; background: #f7f7f5; border: 1rpx solid #e6e4dd; border-radius: 12rpx; }
.infer-note-txt { font-size: 24rpx; color: #6b7280; line-height: 1.7; }
.tags { margin-top: 12rpx; }
.tag-flavor { background: #fff4e6; color: #a83a0b; }
.pill { margin-left: 4rpx; }
.st-on_sale { background: #e6f7ea; color: #1f7a33; }
.st-pending { background: #fff4e6; color: #b4460a; }
.st-off_sale { background: #f1f2f5; color: #5b6470; }
.load-more { text-align: center; padding: 16rpx 0 40rpx; }
.more-link { color: #2563a8; font-size: 26rpx; }
.mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4); display: flex; align-items: flex-end; z-index: 9999;
}
.sheet {
  width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + 60px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  max-height: 80vh; overflow-y: auto;
}
</style>
