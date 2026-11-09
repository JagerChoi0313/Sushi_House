<template>
  <view class="page">
    <view class="card">
      <view class="row between">
        <text class="section-title">菜品管理（{{ dishes.length }}）</text>
        <view class="btn btn-sm btn-primary" @tap="openForm()">＋ 新增</view>
      </view>
      <view v-for="d in dishes" :key="d.id" class="admin-row">
        <image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="dish-thumb" />
        <view class="flex1">
          <text class="dish-name">{{ d.name }}</text>
          <text class="muted row-sub">¥{{ d.price }} · {{ d.calories != null ? d.calories + ' kcal' : '热量未录入' }} · {{ STATUS_LABEL[d.status] }}</text>
        </view>
        <text class="link" @tap="openForm(d)">编辑</text>
        <text class="link danger" @tap="removeDish(d)">删除</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">分类 / 标签</text>
      <view class="row">
        <input class="input flex1" v-model="newCategory" placeholder="新分类名" />
        <view class="btn btn-sm btn-primary" style="margin-left: 12rpx" @tap="addCategory">添加</view>
      </view>
      <view class="row" style="margin-top: 12rpx">
        <input class="input flex1" v-model="newTag" placeholder="新标签名（食材/口味）" />
        <view class="btn btn-sm btn-primary" style="margin-left: 12rpx" @tap="addTag">添加</view>
      </view>
    </view>

    <view class="card">
      <text class="section-title">勋章门槛</text>
      <view class="row">
        <input class="input flex1" v-model="badgeName" placeholder="勋章名称，如 天妇罗达人" />
      </view>
      <view class="row" style="margin-top: 12rpx">
        <picker :range="tagNames" @change="onBadgeTagChange">
          <view class="input" style="margin-right: 12rpx">目标：{{ badgeTagName }}</view>
        </picker>
        <input class="input" style="width: 160rpx" type="number" v-model="badgeCount" placeholder="次数" />
        <view class="btn btn-sm btn-primary" style="margin-left: 12rpx" @tap="addBadgeRule">添加</view>
      </view>
      <view class="divider"></view>
      <view v-for="b in badgeRules" :key="b.id" class="admin-row">
        <view class="flex1">
          <text class="dish-name">{{ b.name }}</text>
          <text class="muted row-sub">{{ b.type === 'unlock' ? '首尝解锁' : '累计' }} · 需要 {{ b.required_count }} 次</text>
        </view>
        <text class="muted">{{ b.description }}</text>
      </view>
    </view>

    <view v-if="showForm" class="mask" @tap="showForm = false">
      <view class="sheet" @tap.stop>
        <text class="title">{{ form.id ? '编辑菜品' : '新增菜品' }}</text>
        <view class="field"><text class="label">菜名</text><input class="input" v-model="form.name" /></view>
        <view class="field">
          <text class="label">分类</text>
          <picker :range="categoryNames" @change="onCategoryChange">
            <view class="input">{{ categoryName(form.categoryId) }}</view>
          </picker>
        </view>
        <view class="row">
          <view class="field flex1" style="margin-right: 12rpx">
            <text class="label">价格（元）</text>
            <input class="input" type="digit" v-model="form.price" />
          </view>
          <view class="field flex1">
            <text class="label">热量（kcal）</text>
            <input class="input" type="digit" v-model="form.calories" />
          </view>
        </view>
        <view class="field">
          <text class="label">状态</text>
          <picker :range="statusLabels" @change="onStatusChange">
            <view class="input">{{ STATUS_LABEL[form.status] }}</view>
          </picker>
        </view>
        <view class="field" v-if="form.status === 'pending'">
          <text class="label">预计上架日期</text>
          <input class="input" v-model="form.expectedDate" placeholder="2026-12-15" />
        </view>
        <view class="field">
          <text class="label">标签</text>
          <view class="tags">
            <text
              v-for="t in allTags"
              :key="t.id"
              :class="['tag', form.tagIds.indexOf(t.id) >= 0 ? 'tag-on' : '']"
              @tap="toggleTag(t.id)"
            >{{ t.name }}</text>
          </view>
        </view>
        <view class="row" style="margin-top: 20rpx">
          <view class="btn btn-ghost" style="flex: 1; margin-right: 16rpx" @tap="showForm = false">取消</view>
          <view class="btn btn-primary" style="flex: 1" @tap="submitForm">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { STATUS_LABEL, BASE_URL } from '../../common/config.js'

const dishes = ref([])
const categories = ref([])
const allTags = ref([])
const badgeRules = ref([])
const showForm = ref(false)
const newCategory = ref('')
const newTag = ref('')
const badgeName = ref('')
const badgeCount = ref('15')
const badgeTagIndex = ref(0)

const emptyForm = () => ({ id: null, name: '', categoryId: null, price: '', calories: '', status: 'on_sale', expectedDate: '', tagIds: [] })
const form = ref(emptyForm())

const statusOptions = [
  { label: '在售', value: 'on_sale' },
  { label: '待上架', value: 'pending' },
  { label: '已下架', value: 'off_sale' },
]
const statusLabels = computed(() => statusOptions.map((s) => s.label))
const categoryNames = computed(() => categories.value.map((c) => c.name))
const tagNames = computed(() => allTags.value.map((t) => t.name))
const badgeTagName = computed(() => (allTags.value[badgeTagIndex.value] ? allTags.value[badgeTagIndex.value].name : '选择标签'))

function toast(t) { uni.showToast({ title: t, icon: 'none' }) }
function categoryName(id) {
  const c = categories.value.find((x) => x.id === id)
  return c ? c.name : '未分类'
}

function onCategoryChange(e) {
  const idx = Number(e.detail.value)
  form.value.categoryId = categories.value[idx] ? categories.value[idx].id : null
}
function onStatusChange(e) {
  form.value.status = statusOptions[Number(e.detail.value)].value
}
function onBadgeTagChange(e) {
  badgeTagIndex.value = Number(e.detail.value)
}
function toggleTag(id) {
  const i = form.value.tagIds.indexOf(id)
  if (i >= 0) form.value.tagIds.splice(i, 1)
  else form.value.tagIds.push(id)
}

function openForm(d) {
  if (d) {
    form.value = {
      id: d.id,
      name: d.name,
      categoryId: d.category_id,
      price: d.price,
      calories: d.calories == null ? '' : d.calories,
      status: d.status,
      expectedDate: d.expected_date || '',
      tagIds: (d.tags || []).map((t) => t.id),
    }
  } else {
    form.value = emptyForm()
  }
  showForm.value = true
}

async function load() {
  try {
    const [d, c, t, b] = await Promise.all([
      api.get('/api/dishes?status=on_sale,pending,off_sale'),
      api.get('/api/categories'),
      api.get('/api/tags'),
      api.get('/api/badges'),
    ])
    dishes.value = d.dishes || []
    categories.value = c.categories || []
    allTags.value = t.tags || []
    badgeRules.value = b.badges || []
  } catch (e) {
    toast(e.message)
  }
}

async function submitForm() {
  if (!form.value.name.trim()) return toast('请填写菜名')
  const payload = {
    name: form.value.name.trim(),
    categoryId: form.value.categoryId,
    price: Number(form.value.price) || 0,
    calories: form.value.calories === '' ? null : Number(form.value.calories),
    status: form.value.status,
    expectedDate: form.value.status === 'pending' ? form.value.expectedDate || null : null,
    tagIds: form.value.tagIds,
  }
  try {
    if (form.value.id) await api.put('/api/admin/dishes/' + form.value.id, payload)
    else await api.post('/api/admin/dishes', payload)
    showForm.value = false
    toast('已保存')
    load()
  } catch (e) {
    toast(e.message)
  }
}

async function removeDish(d) {
  const ok = await new Promise((r) =>
    uni.showModal({ title: '删除菜品', content: '确定删除「' + d.name + '」？历史记录中的菜品会保留。', success: (res) => r(res.confirm) })
  )
  if (!ok) return
  try {
    await api.del('/api/admin/dishes/' + d.id)
    toast('已删除')
    load()
  } catch (e) {
    toast(e.message)
  }
}

async function addCategory() {
  if (!newCategory.value.trim()) return toast('请输入分类名')
  try {
    await api.post('/api/admin/categories', { name: newCategory.value.trim() })
    newCategory.value = ''
    toast('已添加')
    load()
  } catch (e) {
    toast(e.message)
  }
}

async function addTag() {
  if (!newTag.value.trim()) return toast('请输入标签名')
  try {
    await api.post('/api/admin/tags', { name: newTag.value.trim() })
    newTag.value = ''
    toast('已添加')
    load()
  } catch (e) {
    toast(e.message)
  }
}

async function addBadgeRule() {
  if (!badgeName.value.trim()) return toast('请输入勋章名称')
  const tag = allTags.value[badgeTagIndex.value]
  if (!tag) return toast('请选择标签')
  try {
    await api.post('/api/admin/badge-rules', {
      type: 'milestone',
      tagId: tag.id,
      requiredCount: Number(badgeCount.value) || 1,
      name: badgeName.value.trim(),
      description: `累计确认吃过「${tag.name}」标签菜品 ${Number(badgeCount.value) || 1} 次解锁`,
    })
    badgeName.value = ''
    toast('已添加')
    load()
  } catch (e) {
    toast(e.message)
  }
}

onShow(() => load())
</script>

<style scoped>
.admin-row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.admin-row:last-child { border-bottom: none; }
.dish-thumb { width: 96rpx; height: 96rpx; border-radius: 12rpx; margin-right: 20rpx; flex-shrink: 0; background: #f1f2f5; }
.dish-name { font-size: 28rpx; font-weight: 600; }
.row-sub { display: block; margin-top: 4rpx; }
.link { color: #3b82f6; font-size: 26rpx; margin-left: 20rpx; }
.danger { color: #e64a45; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 24rpx; color: #5b6470; margin-bottom: 10rpx; }
.tag-on { background: #e64a45; color: #fff; }
.mask { position: fixed; left: 0; top: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; z-index: 99; }
.sheet { width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); box-sizing: border-box; max-height: 90vh; overflow-y: auto; }
</style>
