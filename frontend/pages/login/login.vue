<template>
  <view class="login-wrap">
    <view class="brand">
      <text class="brand-title">🍣 寿司朗点餐测评</text>
      <text class="brand-sub">优化预算 · 判断口味 · 以最低成本得到良好体验</text>
    </view>

    <view class="card">
      <view class="tabs">
        <view :class="['tab', mode === 'login' ? 'active' : '']" @tap="mode = 'login'">登录</view>
        <view :class="['tab', mode === 'register' ? 'active' : '']" @tap="mode = 'register'">注册</view>
      </view>

      <view class="field">
        <text class="label">用户名</text>
        <input class="input" v-model="form.username" placeholder="3-20 位字母/数字/下划线" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input class="input" v-model="form.password" type="password" placeholder="至少 6 位" />
      </view>
      <view class="field" v-if="mode === 'register'">
        <text class="label">昵称</text>
        <input class="input" v-model="form.nickname" placeholder="选填" />
      </view>

      <button class="btn btn-primary" :disabled="loading" @tap="submit">
        {{ loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录' }}
      </button>

      <view class="hint">
        <text class="muted">演示账号：demo / demo123　管理员：admin / admin123</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../../common/api.js'

const mode = ref('login')
const form = ref({ username: '', password: '', nickname: '' })
const loading = ref(false)

async function submit() {
  const username = (form.value.username || '').trim()
  const password = form.value.password || ''
  if (!username || !password) return uni.showToast({ title: '请填写账号密码', icon: 'none' })
  if (mode.value === 'register' && password.length < 6)
    return uni.showToast({ title: '密码至少 6 位', icon: 'none' })

  loading.value = true
  try {
    const data =
      mode.value === 'login'
        ? await api.post('/api/auth/login', { username, password })
        : await api.post('/api/auth/register', {
            username,
            password,
            nickname: (form.value.nickname || '').trim() || username,
          })
    uni.setStorageSync('token', data.token)
    uni.setStorageSync('user', data.user)
    uni.showToast({ title: '欢迎回来', icon: 'success' })
    setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 300)
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap { min-height: 100vh; padding: 120rpx 48rpx 48rpx; box-sizing: border-box; }
.brand { text-align: center; margin-bottom: 60rpx; }
.brand-title { display: block; font-size: 44rpx; font-weight: 700; color: #1f2329; }
.brand-sub { display: block; margin-top: 16rpx; font-size: 24rpx; color: #8a8f99; }
.tabs { display: flex; margin-bottom: 30rpx; background: #f1f2f5; border-radius: 14rpx; padding: 6rpx; }
.tab { flex: 1; text-align: center; padding: 18rpx 0; border-radius: 12rpx; font-size: 28rpx; color: #5b6470; }
.tab.active { background: #ffffff; color: #e64a45; font-weight: 600; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06); }
.field { margin-bottom: 24rpx; }
.label { display: block; font-size: 24rpx; color: #5b6470; margin-bottom: 10rpx; }
.hint { margin-top: 22rpx; text-align: center; }
.btn { width: 100%; margin-top: 12rpx; }
</style>
