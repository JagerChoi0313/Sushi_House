<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <input class="input flex1" v-model="search" placeholder="搜索菜品" confirm-type="search" @confirm="reload" />
        <view class="btn btn-sm btn-primary search-btn" @tap="reload">搜索</view>
      </view>
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view :class="['chip', categoryId === 0 ? 'active' : '']" @tap="setCategory(0)">全部</view>
        <view
          v-for="c in categories"
          :key="c.id"
          :class="['chip', categoryId === c.id ? 'active' : '']"
          @tap="setCategory(c.id)"
        >{{ c.name }}</view>
      </scroll-view>
      <view class="row wrap">
        <view
          v-for="f in statusFilters"
          :key="f.value"
          :class="['chip', status === f.value ? 'active' : '']"
          @tap="setStatus(f.value)"
        >{{ f.label }}</view>
      </view>
      <view v-if="allergens.length" class="allergen-filter">
        <view class="row between">
          <text class="muted">避开过敏原{{ excluded.length ? '（已排除 ' + excluded.length + ' 项）' : '' }}</text>
          <text v-if="excluded.length" class="clear-link" @tap="clearAllergens">清除</text>
        </view>
        <scroll-view scroll-x class="chips" :show-scrollbar="false">
          <view
            v-for="a in allergens"
            :key="a.name"
            :class="['chip', 'chip-sm', excludedSet.has(a.name) ? 'chip-excluded' : '']"
            @tap="toggleAllergen(a.name)"
          >{{ a.label || allergenLabel(a.name) }} {{ a.count }}</view>
        </scroll-view>
      </view>
    </view>

    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="!dishes.length" class="empty">没有找到菜品</view>
    <view v-else class="row between list-head">
      <text class="muted">共 {{ total }} 道{{ dishes.length < total ? '，已显示 ' + dishes.length : '' }}</text>
      <text v-if="excluded.length" class="muted">已排除过敏原</text>
    </view>

    <view v-for="d in dishes" :key="d.id" class="card dish" @tap="detail = d">
      <view class="row between">
        <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="dish-thumb" lazy-load />
        <view class="flex1">
          <view class="row">
            <text class="dish-name">{{ d.name }}</text>
            <text :class="['pill', 'st-' + d.status]">{{ statusLabel(d.status) }}</text>
          </view>
          <view class="dish-meta muted">
            <text>¥{{ d.price }}</text>
            <text v-if="kcalOf(d)"> · {{ kcalOf(d) }} kcal</text>
            <text v-if="d.status === 'pending' && d.expected_date"> · 预计 {{ d.expected_date }}</text>
          </view>
          <view class="tags">
            <text v-for="t in d.tags" :key="t.id" :class="['tag', t.type === 'flavor' ? 'tag-flavor' : '']">{{ t.name }}</text>
            <text
              v-for="a in (d.allergens || [])"
              :key="'al-' + a"
              :class="['tag', 'tag-allergen', excludedSet.has(a) ? 'tag-danger' : '']"
            >{{ allergenLabel(a) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="dishes.length < total" class="load-more">
      <text class="more-link" @tap="showMore">{{ loadingMore ? '加载中…' : '加载更多（' + dishes.length + '/' + total + '）' }}</text>
    </view>

    <view v-if="detail" class="mask" @tap="detail = null">
      <view class="sheet" @tap.stop>
        <image v-if="detail.image" :src="BASE_URL + detail.image" mode="aspectFit" class="detail-img" />
        <view class="row between">
          <text class="title">{{ detail.name }}</text>
          <text class="muted" @tap="detail = null">关闭 ✕</text>
        </view>
        <view class="muted" style="margin: 12rpx 0">
          {{ statusLabel(detail.status) }} · {{ detail.allergen_source ? '热量/过敏原为推断值' : '官网未提供营养信息' }}
        </view>
        <view class="detail-nutrition" v-if="kcalOf(detail)">
          <view class="nut-item">
            <text class="nut-num">{{ kcalOf(detail) }}</text>
            <text class="nut-label">kcal / {{ detail.kcal_unit || '份' }}</text>
          </view>
          <view class="nut-item">
            <text class="nut-num">¥{{ detail.price }}</text>
            <text class="nut-label">单价</text>
          </view>
        </view>
        <view v-if="detail.allergens && detail.allergens.length" class="allergen-box">
          <text class="allergen-title">可能含有（日本28品目推断）</text>
          <view class="tags">
            <text
              v-for="a in detail.allergens"
              :key="'d-' + a"
              :class="['tag', 'tag-allergen', excludedSet.has(a) ? 'tag-danger' : '']"
            >{{ allergenLabel(a) }}</text>
          </view>
        </view>
        <view class="tags">
          <text v-for="t in detail.tags" :key="t.id" class="tag">{{ t.name }}</text>
        </view>
        <text class="muted">{{ detail.description || '暂无描述' }}</text>
        <button class="btn btn-primary" style="margin-top: 24rpx" @tap="recordDish">去记录这道菜</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { STATUS_LABEL, BASE_URL } from '../../common/config.js'
import { errMsg } from '../../common/util.js'

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
const allergens = ref([])
const excluded = ref([])
const excludedSet = computed(() => new Set(excluded.value))

const ALLERGEN_ZH = {
  卵: '蛋', 乳: '乳制品', 小麦: '小麦', えび: '虾', かに: '蟹', そば: '荞麦',
  落花生: '花生', くるみ: '核桃', アーモンド: '杏仁', あわび: '鲍鱼', いか: '乌贼',
  いくら: '鲑鱼卵', オレンジ: '橙', カシューナッツ: '腰果', キウイフルーツ: '奇异果',
  牛肉: '牛肉', ごま: '芝麻', さけ: '鲑鱼', さば: '鲭鱼', 大豆: '大豆',
  鶏肉: '鸡肉', バナナ: '香蕉', 豚肉: '猪肉', もも: '桃', やまいも: '山药',
  りんご: '苹果', ゼラチン: '明胶', マカダミアナッツ: '夏威夷果',
}
function allergenLabel(a) { return ALLERGEN_ZH[a] || a }
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

function statusLabel(s) { return STATUS_LABEL[s] || s }

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
    params.push('limit=' + PAGE_STEP)
    params.push('offset=' + offset)
    const data = await api.get('/api/dishes?' + params.join('&'))
    const list = data.dishes || []
    dishes.value = append ? dishes.value.concat(list) : list
    // data.total 是符合条件的总数；老版本后端没有这个字段时退化成当前条数
    total.value = data.total != null ? data.total : dishes.value.length
  } catch (e) {
    if (!append) dishes.value = []
    uni.showToast({ title: errMsg(e), icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadCategories() {
  try {
    const [c, a] = await Promise.all([api.get('/api/categories'), api.get('/api/allergens')])
    categories.value = c.categories || []
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
.chip.active { background: #e64a45; color: #fff; }
.chip-sm { padding: 8rpx 20rpx; font-size: 22rpx; }
.chip-excluded { background: #fdeaea; color: #e64a45; }
.allergen-filter { margin-top: 8rpx; padding-top: 16rpx; border-top: 1rpx solid #f1f2f5; }
.clear-link { color: #3b82f6; font-size: 24rpx; }
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
.tags { margin-top: 12rpx; }
.tag-flavor { background: #fff4e6; color: #d9480f; }
.pill { margin-left: 4rpx; }
.st-on_sale { background: #e6f7ea; color: #2f9e44; }
.st-pending { background: #fff4e6; color: #e8590c; }
.st-off_sale { background: #f1f2f5; color: #8a8f99; }
.load-more { text-align: center; padding: 16rpx 0 40rpx; }
.more-link { color: #3b82f6; font-size: 26rpx; }
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
