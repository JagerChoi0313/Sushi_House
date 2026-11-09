<template>
  <view class="page">
    <!-- 顶部搜索 -->
    <view class="card search-card">
      <view class="row">
        <input
          class="input flex1"
          v-model="search"
          placeholder="搜菜名 / 食材，如 三文鱼、tuna、鮭魚"
          confirm-type="search"
          @confirm="reload"
        />
        <view class="btn btn-sm btn-primary search-btn" @tap="reload">搜索</view>
      </view>
      <view class="row between stats">
        <text class="muted">{{ scopeText }}</text>
        <text v-if="search" class="clear-link" @tap="clearSearch">清除</text>
      </view>
    </view>

    <!-- 地区切换 -->
    <scroll-view scroll-x class="chips" :show-scrollbar="false">
      <view :class="['chip', region === 'ALL' ? 'active' : '']" @tap="setRegion('ALL')">
        全部 {{ total }}
      </view>
      <view
        v-for="r in regions"
        :key="r.code"
        :class="['chip', region === r.code ? 'active' : '']"
        @tap="setRegion(r.code)"
      >{{ r.name }} {{ r.count }}</view>
    </scroll-view>

    <!-- 分类 -->
    <scroll-view scroll-x class="chips" :show-scrollbar="false">
      <view :class="['chip', 'chip-sm', category === '' ? 'active' : '']" @tap="setCategory('')">全部分类</view>
      <view
        v-for="c in categories"
        :key="c.name"
        :class="['chip', 'chip-sm', category === c.name ? 'active' : '']"
        @tap="setCategory(c.name)"
      >{{ c.name }} {{ c.count }}</view>
    </scroll-view>

    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="!dishes.length" class="empty">没有找到菜品</view>

    <!-- 菜品网格 -->
    <view v-else class="grid">
      <view v-for="d in dishes" :key="d.id" class="dish" @tap="openDish(d)">
        <view class="thumb-box">
          <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="thumb" lazy-load />
          <view v-else class="thumb thumb-none">
            <text class="thumb-none-txt">{{ d.region }}</text>
            <text class="thumb-none-sub">无单品图</text>
          </view>
          <view class="region-badge">{{ d.region }}</view>
        </view>
        <view class="dish-body">
          <text class="dish-name">{{ d.name }}</text>
          <text v-if="d.name_zh && d.name_zh !== d.name" class="dish-zh">{{ d.name_zh }}</text>
          <view class="row between dish-foot">
            <text class="price">{{ d.price_display }}</text>
            <text class="cny">≈¥{{ d.price_cny }}</text>
          </view>
          <text class="cat-txt">{{ d.category }}</text>
        </view>
      </view>
    </view>

    <!-- 分页加载 -->
    <view v-if="dishes.length" class="load-more">
      <text v-if="loadingMore" class="muted">加载中…</text>
      <text v-else-if="hasMore" class="more-link" @tap="loadMore">加载更多（{{ dishes.length }}/{{ matched }}）</text>
      <text v-else class="muted">已全部加载 {{ dishes.length }} 道</text>
    </view>

    <!-- 详情 -->
    <view v-if="detail" class="mask" @tap="detail = null">
      <view class="sheet" @tap.stop>
        <image v-if="detail.image" :src="BASE_URL + detail.image" mode="aspectFit" class="detail-img" />
        <view class="row between">
          <text class="title">{{ detail.name }}</text>
          <text class="muted" @tap="detail = null">关闭 ✕</text>
        </view>
        <text v-if="detail.name_zh && detail.name_zh !== detail.name" class="detail-zh">{{ detail.name_zh }}</text>
        <view class="detail-meta">
          <text class="tag tag-region">{{ detail.region }}</text>
          <text class="tag">{{ detail.category }}</text>
        </view>
        <view class="detail-price">
          <view class="dp-item">
            <text class="dp-num">{{ detail.price_display }}</text>
            <text class="dp-label">当地售价</text>
          </view>
          <view class="dp-item">
            <text class="dp-num">¥{{ detail.price_cny }}</text>
            <text class="dp-label">折合人民币</text>
          </view>
        </view>

        <view v-if="detail.ingredients" class="kv">
          <text class="kv-k">食材</text>
          <text class="kv-v">{{ labelOf(detail.ingredients, ING_ZH) }}</text>
        </view>
        <view v-if="detail.forms" class="kv">
          <text class="kv-k">形态</text>
          <text class="kv-v">{{ labelOf(detail.forms, FORM_ZH) }}</text>
        </view>
        <view v-if="detail.flavors" class="kv">
          <text class="kv-k">风味</text>
          <text class="kv-v">{{ labelOf(detail.flavors, FLAVOR_ZH) }}</text>
        </view>

        <view v-if="siblings.length" class="sib-box">
          <text class="sib-title">
            同食材同形态 · 跨地区比价（共 {{ siblingPlaces }} 地{{ siblingsHidden > 0 ? '，只显示最便宜 ' + siblings.length + ' 条' : '' }}）
          </text>
          <view v-for="(s, i) in allSiblings" :key="i" class="sib-row">
            <text :class="['sib-region', s.isSelf ? 'sib-self' : '']">{{ s.region }}</text>
            <text class="sib-name">{{ s.name_zh || s.name }}</text>
            <text class="sib-price">{{ s.price_display }}</text>
            <text class="sib-cny">¥{{ s.price_cny }}</text>
            <text v-if="s.isSelf" class="sib-flag">本页</text>
            <text v-else-if="s.flavorMatch === false" class="sib-flag sib-flag-diff">口味不同</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { BASE_URL } from '../../common/config.js'
import { errMsg, splitList } from '../../common/util.js'

const PAGE_SIZE = 60

const regions = ref([])
const total = ref(0)
const withImage = ref(0)
const region = ref('ALL')
const category = ref('')
const search = ref('')
const dishes = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const matched = ref(0)
const hasMore = ref(false)
const detail = ref(null)
const detailLoading = ref(false)
const siblings = ref([])
const siblingsTotal = ref(0)

// 三张独立字典：食材 / 形态 / 风味，避免混表后同名 key 互相覆盖
const ING_ZH = {
  salmon: '三文鱼', tuna: '金枪鱼', shrimp: '虾', squid: '鱿鱼', octopus: '章鱼',
  egg: '鸡蛋', mackerel: '鲭鱼', yellowtail: '鰤鱼', eel: '鳗鱼', crab: '蟹',
  scallop: '扇贝', clam: '蛤蜊', ark_shell: '赤贝', uni: '海胆', roe: '鱼卵',
  ikura: '鲑鱼卵', herring: '鲱鱼', bonito: '鲣鱼', bream: '鲷鱼', flounder: '比目鱼',
  beef: '牛肉', chicken: '鸡肉', pork: '猪肉', ham: '火腿', cheese: '奶酪',
  avocado: '牛油果', cucumber: '黄瓜', onion: '洋葱', seaweed: '海苔', natto: '纳豆',
  corn: '玉米', tofu: '豆腐', inari: '豆皮', rice: '米饭', noodle: '面',
  udon: '乌冬', soysauce: '酱油', miso: '味噌', mayo: '蛋黄酱', wasabi: '芥末',
  ginger: '姜', garlic: '蒜', sesame: '芝麻', tomato: '番茄', lettuce: '生菜',
  potato: '土豆', pumpkin: '南瓜', mushroom: '蘑菇', asparagus: '芦笋',
  mentaiko: '明太子', radish: '萝卜', okra: '秋葵', yam: '山药', beef_galbi: '牛肋排',
}
const FORM_ZH = {
  nigiri: '握寿司', gunkan: '军舰', maki: '卷类', temaki: '手卷', tsutsumi: '海苔包',
  sashimi: '刺身', aburi: '炙烤', salad: '沙拉', soup: '汤', ramen: '拉面',
  donburi: '盖饭', dessert: '甜点', drink: '饮料', set: '套餐', platter: '拼盘',
  wrap: '手卷', oshisushi: '押寿司', inari: '豆皮寿司', bowl: '丼',
}
const FLAVOR_ZH = {
  spicy: '辣', grilled: '烤', fried: '炸', sweet: '甜', salty: '咸', sour: '酸',
  creamy: '奶香', smoky: '烟熏', fresh: '鲜', savory: '咸鲜', light: '清爽',
}

function labelOf(s, dict) {
  return splitList(s)
    .map((k) => dict[k] || k)
    .join('、')
}

const categories = computed(() => {
  if (region.value === 'ALL') {
    const m = new Map()
    for (const r of regions.value) {
      for (const c of r.categories || []) {
        m.set(c.name, (m.get(c.name) || 0) + c.count)
      }
    }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }
  const r = regions.value.find((x) => x.code === region.value)
  return r ? r.categories || [] : []
})

// 顶部统计：切换地区/分类/搜索后必须反映「当前范围」，否则用户会以为筛选没生效
const scopeText = computed(() => {
  const parts = []
  if (region.value !== 'ALL') {
    const r = regions.value.find((x) => x.code === region.value)
    parts.push(r ? r.name : region.value)
  }
  if (category.value) parts.push(category.value)
  if (search.value.trim()) parts.push('“' + search.value.trim() + '”')
  if (!parts.length) {
    return '七地区共 ' + total.value + ' 道 · 有图 ' + withImage.value + ' 道'
  }
  return parts.join(' · ') + ' 共 ' + matched.value + ' 道'
})

// 后端一次最多给 20 条对照，siblingsTotal 是真实条数（最多的一组有 49 行）
const siblingPlaces = computed(() => (siblingsTotal.value > 0 ? siblingsTotal.value + 1 : siblings.value.length + 1))
const siblingsHidden = computed(() => Math.max(0, siblingsTotal.value - siblings.value.length))

const allSiblings = computed(() => {
  if (!detail.value) return []
  const self = {
    region: detail.value.region,
    name: detail.value.name,
    name_zh: detail.value.name_zh,
    price_display: detail.value.price_display,
    price_cny: detail.value.price_cny,
    isSelf: true,
  }
  // 价格可能为空（询价 / 停售），空的排到最后，别让 NaN 把顺序打乱
  const key = (x) => (x.price_cny == null ? Number.POSITIVE_INFINITY : Number(x.price_cny))
  return [self, ...siblings.value].sort((a, b) => key(a) - key(b))
})

function buildQuery(offset) {
  const params = []
  if (region.value !== 'ALL') params.push('region=' + encodeURIComponent(region.value))
  if (category.value) params.push('category=' + encodeURIComponent(category.value))
  if (search.value.trim()) params.push('search=' + encodeURIComponent(search.value.trim()))
  params.push('limit=' + PAGE_SIZE)
  params.push('offset=' + offset)
  return '/api/world/dishes?' + params.join('&')
}

function setRegion(code) {
  region.value = code
  category.value = ''
  reload()
}
function setCategory(name) {
  category.value = name
  reload()
}
function clearSearch() {
  search.value = ''
  reload()
}
function reload() {
  loadDishes(true)
}

async function loadMeta() {
  try {
    const data = await api.get('/api/world/meta')
    regions.value = data.regions || []
    total.value = data.total || 0
    withImage.value = data.withImage || 0
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

async function loadDishes(reset) {
  if (reset) {
    loading.value = true
    dishes.value = []
    hasMore.value = false
    matched.value = 0
  } else {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }
  try {
    const data = await api.get( buildQuery(reset ? 0 : dishes.value.length) )
    const rows = data.dishes || []
    dishes.value = reset ? rows : dishes.value.concat(rows)
    matched.value = Number(data.total) || dishes.value.length
    hasMore.value = dishes.value.length < matched.value && rows.length > 0
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  loadDishes(false)
}

async function openDish(d) {
  // 先用列表项立即渲染，避免点击后空白等待
  detail.value = d
  siblings.value = []
  siblingsTotal.value = 0
  detailLoading.value = true
  try {
    const data = await api.get('/api/world/dishes/' + d.id)
    // 接口返回 { dish, siblings, siblingsTotal }，详情必须用 dish（列表项可能缺字段）
    if (data && data.dish) detail.value = data.dish
    siblings.value = (data && data.siblings) || []
    siblingsTotal.value = (data && data.siblingsTotal) || 0
  } catch (e) {
    /* 详情拉取失败时保留列表项数据，不打断浏览 */
  } finally {
    detailLoading.value = false
  }
}

onShow(() => {
  loadMeta()
  if (!dishes.value.length) loadDishes(true)
})

onReachBottom(() => {
  loadMore()
})
</script>

<style scoped>
.search-card { padding-bottom: 18rpx; }
.search-btn { margin-left: 16rpx; }
.stats { margin-top: 14rpx; }
.clear-link { color: #3b82f6; font-size: 24rpx; }

.chips { white-space: nowrap; margin: 4rpx 0 12rpx; }
.chip {
  display: inline-block; padding: 12rpx 26rpx; margin: 0 12rpx 8rpx 0;
  border-radius: 999rpx; background: #ffffff; color: #5b6470; font-size: 25rpx;
  box-shadow: 0 2rpx 8rpx rgba(20, 24, 40, 0.05);
}
.chip.active { background: #e64a45; color: #fff; box-shadow: 0 4rpx 12rpx rgba(230, 74, 69, 0.28); }
.chip-sm { padding: 8rpx 20rpx; font-size: 22rpx; }

.grid { display: flex; flex-wrap: wrap; justify-content: space-between; }
.dish {
  width: 48.6%; background: #fff; border-radius: 18rpx; overflow: hidden;
  margin-bottom: 18rpx; box-shadow: 0 2rpx 12rpx rgba(20, 24, 40, 0.06);
}
.thumb-box { position: relative; width: 100%; height: 220rpx; background: #f7f8fa; }
.thumb { width: 100%; height: 220rpx; display: block; }
.thumb-none { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f2f3f6; }
.thumb-none-txt { font-size: 26rpx; color: #b6bcc6; font-weight: 600; }
.thumb-none-sub { font-size: 20rpx; color: #c8cdd5; margin-top: 6rpx; }
.region-badge {
  position: absolute; left: 10rpx; top: 10rpx; padding: 4rpx 14rpx;
  border-radius: 999rpx; background: rgba(20, 24, 40, 0.62); color: #fff; font-size: 20rpx;
}
.dish-body { padding: 14rpx 16rpx 18rpx; }
.dish-name {
  display: block; font-size: 26rpx; font-weight: 600; color: #1f2329; line-height: 1.35;
  height: 70rpx; overflow: hidden;
}
.dish-zh {
  display: block; font-size: 22rpx; color: #3b82f6; margin-top: 2rpx;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dish-foot { margin-top: 10rpx; }
.price { font-size: 26rpx; font-weight: 700; color: #e64a45; }
.cny { font-size: 21rpx; color: #8a8f99; }
.cat-txt { display: block; font-size: 20rpx; color: #a4a9b3; margin-top: 6rpx; }

.load-more { text-align: center; padding: 24rpx 0 40rpx; }
.more-link { color: #3b82f6; font-size: 26rpx; }

.mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45); display: flex; align-items: flex-end; z-index: 9999;
}
.sheet {
  width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box; max-height: 82vh; overflow-y: auto;
}
.detail-img {
  width: 460rpx; height: 340rpx; max-width: 100%; display: block; margin: 0 auto 20rpx;
  border-radius: 18rpx; background: #f7f8fa;
}
.detail-zh { display: block; font-size: 26rpx; color: #3b82f6; margin-top: 6rpx; }
.detail-meta { margin: 16rpx 0; }
.tag-region { background: #fff0f0; color: #c92a2a; }
.detail-price { display: flex; background: #f7f8fa; border-radius: 16rpx; padding: 22rpx 0; margin: 10rpx 0 20rpx; }
.dp-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.dp-num { font-size: 32rpx; font-weight: 700; color: #1f2329; }
.dp-label { font-size: 20rpx; color: #8a8f99; margin-top: 6rpx; }
.kv { display: flex; margin-bottom: 10rpx; }
.kv-k { width: 90rpx; font-size: 24rpx; color: #8a8f99; flex-shrink: 0; }
.kv-v { flex: 1; font-size: 24rpx; color: #3b4350; }
.sib-box { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #eef0f3; }
.sib-title { display: block; font-size: 24rpx; font-weight: 600; margin-bottom: 12rpx; }
.sib-row { display: flex; align-items: center; padding: 10rpx 0; border-bottom: 1rpx dashed #f1f2f5; }
.sib-region { width: 100rpx; font-size: 22rpx; color: #8a8f99; flex-shrink: 0; }
.sib-self { color: #e64a45; font-weight: 700; }
.sib-name { flex: 1; font-size: 23rpx; color: #3b4350; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sib-price { font-size: 22rpx; color: #5b6470; margin: 0 16rpx; }
.sib-cny { font-size: 24rpx; font-weight: 700; color: #e64a45; width: 90rpx; text-align: right; }
.sib-flag { font-size: 19rpx; color: #e64a45; border: 1rpx solid #f2c4c1; border-radius: 6rpx; padding: 0 8rpx; margin-left: 10rpx; flex-shrink: 0; }
.sib-flag-diff { color: #8a8f99; border-color: #e2e5ea; }
</style>
