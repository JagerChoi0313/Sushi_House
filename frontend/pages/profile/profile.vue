<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <view class="avatar">{{ (user.nickname || '食')[0] }}</view>
        <view class="flex1" style="margin-left: 20rpx">
          <text class="title">{{ user.nickname || user.username }}</text>
          <text class="muted">@{{ user.username }} · {{ user.role === 'admin' ? '管理员' : '食客' }}</text>
        </view>
      </view>
      <view class="row stats">
        <view class="stat"><text class="stat-num">{{ stats.mealCount }}</text><text class="muted">用餐</text></view>
        <view class="stat"><text class="stat-num">{{ stats.unlocked }}</text><text class="muted">解锁</text></view>
        <view class="stat"><text class="stat-num">{{ stats.badgeCount }}</text><text class="muted">勋章</text></view>
      </view>
    </view>

    <view class="card">
      <text class="section-title">昵称</text>
      <view class="row">
        <input class="input flex1" v-model="nickname" />
        <view class="btn btn-sm btn-primary" style="margin-left: 16rpx" @tap="saveNickname">保存</view>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">口味偏好与忌口</text>
        <view class="btn btn-sm btn-primary" @tap="savePrefs">保存偏好</view>
      </view>
      <text class="muted" style="display: block; margin-bottom: 14rpx">点击标签选择：喜欢 / 不喜欢 / 忌口 / 过敏 / 清除</text>
      <view class="tags">
        <text v-for="t in tags" :key="t.id" :class="['tag', prefClass(t)]" @tap="choosePref(t)">
          {{ t.name }}<text v-if="t.preference">（{{ PREF_LABEL[t.preference] }}）</text>
        </text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">修改密码</text>
      <input class="input" v-model="oldPwd" password placeholder="原密码" style="margin-bottom: 16rpx" />
      <input class="input" v-model="newPwd" password placeholder="新密码（至少 6 位）" />
      <view class="btn btn-ghost" style="margin-top: 16rpx" @tap="changePwd">确认修改</view>
    </view>

    <view v-if="user.role === 'admin'" class="card" @tap="goAdmin">
      <view class="row between"><text>管理后台</text><text class="muted">菜品 / 标签 / 勋章 ›</text></view>
    </view>

    <view class="btn btn-ghost logout" @tap="logout">退出登录</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { PREF_LABEL } from '../../common/config.js'

const user = ref({})
const stats = ref({ mealCount: 0, unlocked: 0, badgeCount: 0 })
const nickname = ref('')
const tags = ref([])
const oldPwd = ref('')
const newPwd = ref('')

function prefClass(t) {
  if (!t.preference) return ''
  return 'pref-' + t.preference
}

async function load() {
  try {
    const [p, pref] = await Promise.all([api.get('/api/user/profile'), api.get('/api/user/preferences')])
    user.value = p.user || {}
    stats.value = p.stats || stats.value
    nickname.value = p.user ? p.user.nickname || '' : ''
    tags.value = pref.tags || []
  } catch (e) {
    /* ignore */
  }
}

async function saveNickname() {
  try {
    const d = await api.put('/api/user/profile', { nickname: nickname.value })
    user.value = d.user
    uni.setStorageSync('user', d.user)
    uni.showToast({ title: '已保存', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function choosePref(t) {
  const options = ['喜欢', '不喜欢', '忌口', '过敏', '清除']
  const values = ['like', 'dislike', 'avoid', 'allergy', null]
  uni.showActionSheet({
    itemList: options,
    success: (res) => {
      t.preference = values[res.tapIndex]
    },
  })
}

async function savePrefs() {
  const preferences = tags.value
    .filter((t) => t.preference)
    .map((t) => ({ tagId: t.id, type: t.preference }))
  try {
    await api.put('/api/user/preferences', { preferences })
    uni.showToast({ title: '偏好已保存', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function changePwd() {
  if (newPwd.value.length < 6) return uni.showToast({ title: '新密码至少 6 位', icon: 'none' })
  try {
    await api.put('/api/user/password', { oldPassword: oldPwd.value, newPassword: newPwd.value })
    oldPwd.value = ''
    newPwd.value = ''
    uni.showToast({ title: '密码已修改', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function goAdmin() {
  uni.navigateTo({ url: '/pages/admin/admin' })
}

function logout() {
  api.post('/api/auth/logout').catch(() => {})
  uni.removeStorageSync('token')
  uni.removeStorageSync('user')
  uni.reLaunch({ url: '/pages/login/login' })
}

onShow(() => load())
</script>

<style scoped>
.avatar {
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: #e64a45; color: #fff; font-size: 44rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.stats { margin-top: 26rpx; }
.stat { flex: 1; text-align: center; }
.stat-num { display: block; font-size: 34rpx; font-weight: 700; }
.tag { cursor: pointer; }
.pref-like { background: #e6f7ea; color: #2f9e44; }
.pref-dislike { background: #f1f2f5; color: #5b6470; }
.pref-avoid { background: #fff4e6; color: #e8590c; }
.pref-allergy { background: #fdeaea; color: #e64a45; }
.logout { margin-top: 10rpx; }
</style>
