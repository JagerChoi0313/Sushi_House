<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <input class="input flex1" v-model="search" placeholder="搜索菜品" confirm-type="search" @confirm="loadDishes" />
        <view class="btn btn-sm btn-primary search-btn" @tap="loadDishes">搜索</view>
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
    </view>

    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="!dishes.length" class="empty">没有找到菜品</view>

    <view v-for="d in dishes" :key="d.id" class="card dish" @tap="detail = d">
      <view class="row between">
        <view class="flex1">
          <view class="row">
            <text class="dish-name">{{ d.name }}</text>
            <text :class="['pill', 'st-' + d.status]">{{ statusLabel(d.status) }}</text>
          </view>
          <view class="dish-meta muted">
            <text>¥{{ d.price }}</text>
            <text v-if="d.calories != null"> · {{ d.calories }} kcal</text>
            <text v-if="d.status === 'pending' && d.expected_date"> · 预计 {{ d.expected_date }}</text>
          </view>
          <view class="tags">
            <text v-for="t in d.tags" :key="t.id" :class="['tag', t.type === 'flavor' ? 'tag-flavor' : '']">{{ t.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="detail" class="mask" @tap="detail = null">
      <view class="sheet" @tap.stop>
        <view class="row between">
          <text class="title">{{ detail.name }}</text>
          <text class="muted" @tap="detail = null">关闭 ✕</text>
        </view>
        <view class="muted" style="margin: 12rpx 0">
          ¥{{ detail.price }} · {{ detail.calories != null ? detail.calories + ' kcal' : '热量未录入' }} · {{ statusLabel(detail.status) }}
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
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { STATUS_LABEL } from '../../common/config.js'

const categories = ref([])
const categoryId = ref(0)
const status = ref('on_sale,pending')
const statusFilters = [
  { label: '全部', value: 'on_sale,pending,off_sale' },
  { label: '在售', value: 'on_sale' },
  { label: '待上架', value: 'pending' },
  { label: '已下架', value: 'off_sale' },
]
const search = ref('')
const dishes = ref([])
const detail = ref(null)
const loading = ref(false)

function statusLabel(s) { return STATUS_LABEL[s] || s }

function setCategory(id) { categoryId.value = id; loadDishes() }
function setStatus(v) { status.value = v; loadDishes() }

async function loadDishes() {
  loading.value = true
  try {
    const params = []
    if (categoryId.value) params.push('categoryId=' + categoryId.value)
    if (status.value) params.push('status=' + encodeURIComponent(status.value))
    if (search.value.trim()) params.push('search=' + encodeURIComponent(search.value.trim()))
    const qs = params.length ? '?' + params.join('&') : ''
    const data = await api.get('/api/dishes' + qs)
    dishes.value = data.dishes || []
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const data = await api.get('/api/categories')
    categories.value = data.categories || []
  } catch (e) {
    /* ignore */
  }
}

function recordDish() {
  const id = detail.value.id
  detail.value = null
  uni.navigateTo({ url: '/pages/record/record?dishId=' + id })
}

onShow(() => {
  loadCategories()
  loadDishes()
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
.dish-name { font-size: 30rpx; font-weight: 600; margin-right: 12rpx; }
.dish-meta { margin-top: 8rpx; }
.tags { margin-top: 12rpx; }
.tag-flavor { background: #fff4e6; color: #d9480f; }
.pill { margin-left: 4rpx; }
.st-on_sale { background: #e6f7ea; color: #2f9e44; }
.st-pending { background: #fff4e6; color: #e8590c; }
.st-off_sale { background: #f1f2f5; color: #8a8f99; }
.mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4); display: flex; align-items: flex-end; z-index: 99;
}
.sheet {
  width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); box-sizing: border-box;
}
</style>
