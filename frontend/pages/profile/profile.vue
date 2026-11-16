<template>
  <view class="page" :class="{ 'no-anim': noAnim }">
    <view class="card">
      <view class="row">
        <view class="avatar">{{ avatarChar }}</view>
        <view class="flex1" style="margin-left: 20rpx">
          <text class="title">{{ user.nickname || user.username }}</text>
          <text class="muted">@{{ user.username }} · {{ user.role === 'admin' ? t('管理员') : t('食客') }}</text>
        </view>
      </view>
      <view class="row stats">
        <view class="stat" @tap="goHistory" aria-role="button">
          <text class="stat-num">{{ stats.mealCount }}</text>
          <text class="muted">{{ t('用餐') }}</text>
        </view>
        <view class="stat" @tap="goPlan" aria-role="button">
          <text class="stat-num">{{ stats.planCount }}</text>
          <text class="muted">{{ t('计划') }}</text>
        </view>
        <view class="stat" @tap="goEncyclopedia" aria-role="button">
          <text class="stat-num">{{ stats.unlocked }}</text>
          <text class="muted">{{ t('解锁') }}</text>
        </view>
        <view class="stat" @tap="goEncyclopedia" aria-role="button">
          <text class="stat-num">{{ stats.badgeCount }}</text>
          <text class="muted">{{ t('勋章') }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="section-title">{{ t('我的') }}</text>
      <view class="cell" @tap="goHistory" aria-role="button">
        <text class="flex1">{{ t('用餐历史') }}</text>
        <text class="muted">{{ t('{n} 条 ›', { n: stats.mealCount }) }}</text>
      </view>
      <view class="cell" @tap="goPlan" aria-role="button">
        <text class="flex1">{{ t('推荐计划') }}</text>
        <text class="muted">{{ t('{n} 条 ›', { n: stats.planCount }) }}</text>
      </view>
      <view class="cell" @tap="goEncyclopedia" aria-role="button">
        <text class="flex1">{{ t('图鉴与勋章') }}</text>
        <text class="muted">{{ stats.unlocked }} / {{ stats.badgeCount }} ›</text>
      </view>
      <view class="cell" @tap="goWorld" aria-role="button">
        <text class="flex1">{{ t('七地区世界菜单') }}</text>
        <text class="muted">{{ t('1525 道 ›') }}</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">{{ t('昵称') }}</text>
      <view class="row">
        <input class="input flex1" v-model="nickname" />
        <view class="btn btn-sm btn-primary" style="margin-left: 16rpx" @tap="saveNickname" aria-role="button">{{ t('保存') }}</view>
      </view>
    </view>

    <view class="card">
      <view class="row between">
        <text class="section-title">{{ t('口味偏好与忌口') }}</text>
        <view class="btn btn-sm btn-primary" @tap="savePrefs" aria-role="button">{{ t('保存偏好') }}</view>
      </view>
      <text class="muted" style="display: block; margin-bottom: 14rpx">{{ t('点击标签选择：喜欢 / 不喜欢 / 忌口 / 过敏 / 清除') }}</text>
      <view class="tags">
        <text v-for="tg in tags" :key="tg.id" :class="['tag', prefClass(tg)]" @tap="choosePref(tg)" aria-role="button">
          {{ tagLabel(tg.name) }}<text v-if="tg.preference">（{{ t(PREF_LABEL[tg.preference]) }}）</text>
        </text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">{{ t('修改密码') }}</text>
      <input class="input" v-model="oldPwd" password :placeholder="t('原密码')" style="margin-bottom: 16rpx" />
      <input class="input" v-model="newPwd" password :placeholder="t('新密码（至少 6 位）')" />
      <view class="btn btn-ghost" style="margin-top: 16rpx" @tap="changePwd" aria-role="button">{{ t('确认修改') }}</view>
    </view>

    <view v-if="user.role === 'admin'" class="card" @tap="goAdmin" aria-role="button">
      <view class="row between"><text>{{ t('管理后台') }}</text><text class="muted">{{ t('菜品 / 标签 / 勋章 ›') }}</text></view>
    </view>

    <!-- 语言切换。只影响界面文案，菜名 / 店家信息不翻（见 common/i18n.js 顶部注释）。 -->
    <view class="card">
      <view class="row between">
        <view class="flex1">
          <text>{{ t('语言') }}</text>
          <text class="muted" style="display: block; margin-top: 6rpx">
            {{ t('界面文字用哪种语言。菜名和商家信息不翻译。') }}
          </text>
        </view>
      </view>
      <view class="lang-row">
        <view
          v-for="l in LOCALES"
          :key="l.key"
          :class="['lang-chip', locale === l.key ? 'lang-on' : '']"
          @tap="pickLocale(l.key)"
          aria-role="button"
          :aria-label="'switch language to ' + l.label"
        >{{ l.label }}</view>
      </view>
    </view>

    <!-- 审计 B7：动效开关。系统级「减弱动态效果」由 CSS 兜住，这里再给一个应用内开关。 -->
    <view class="card">
      <view class="row between" @tap="toggleAnim" aria-role="button" :aria-label="t('切换界面动效')">
        <view class="flex1">
          <text>{{ t('界面动效') }}</text>
          <text class="muted" style="display: block; margin-top: 6rpx">
            {{ t('列表进场、加载闪动这类动画。觉得晃眼可以关掉。') }}
          </text>
        </view>
        <view :class="['sw', noAnim ? '' : 'sw-on']">
          <view class="sw-dot" :style="{ transform: noAnim ? 'translateX(0)' : 'translateX(40rpx)' }"></view>
        </view>
      </view>
    </view>

    <!-- 审计 B4：评级可关闭。档位词换成中性词只是第一步，能不能不接受这个评价是第二步。 -->
    <view class="card">
      <view class="row between" @tap="toggleTier" aria-role="button" :aria-label="t('切换是否显示系统评级')">
        <view class="flex1">
          <text>{{ t('显示系统评级') }}</text>
          <text class="muted" style="display: block; margin-top: 6rpx">
            {{ t('关掉后，首页、历史记录、详情页都不再显示「很棒 / 不错 / 一般」这类档位，分数也一并隐藏。预算、热量、口味匹配这些事实仍然照常显示，评分数据本身一条都不删。') }}
          </text>
        </view>
        <view :class="['sw', showTier ? 'sw-on' : '']">
          <view class="sw-dot" :style="{ transform: showTier ? 'translateX(40rpx)' : 'translateX(0)' }"></view>
        </view>
      </view>
    </view>

    <view class="btn btn-ghost logout" @tap="logout" aria-role="button">{{ t('退出登录') }}</view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { PREF_LABEL } from '../../common/config.js'
import { errMsg } from '../../common/util.js'
import { showTier, syncShowTier, toggleShowTier } from '../../common/uiPrefs.js'
import { LOCALES, locale, setLocale, t, useLocale } from '../../common/i18n.js'
import { tagLabel } from '../../common/i18nData.js'
// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('我的')

const user = ref({})
const stats = ref({ mealCount: 0, planCount: 0, unlocked: 0, badgeCount: 0 })
const nickname = ref('')
const tags = ref([])
const oldPwd = ref('')
const newPwd = ref('')
// 头像首字：中文取首字，英文取首字母大写（'食' 在英文界面下不该出现）
const avatarChar = computed(() => {
  const n = (user.value.nickname || user.value.username || '').trim()
  if (!n) return 'S'
  return locale.value === 'en' ? n[0].toUpperCase() : n[0]
})

// 审计 B7：动效开关。默认开；关掉后所有 .anim-* 类都不生效（见 App.vue 的 .no-anim）。
const noAnim = ref(false)
function syncNoAnim() {
  try {
    noAnim.value = uni.getStorageSync('noAnim') === true
  } catch {
    noAnim.value = false
  }
}
syncNoAnim()
function toggleAnim() {
  noAnim.value = !noAnim.value
  try {
    uni.setStorageSync('noAnim', noAnim.value)
  } catch {
    /* 存不进去也不影响本次 */
  }
  uni.showToast({ title: noAnim.value ? t('已关闭动效') : t('已开启动效'), icon: 'none' })
}

// 审计 B4：评级显示开关（与动效开关同一套存取方式，见 common/uiPrefs.js）
syncShowTier()
function toggleTier() {
  toggleShowTier()
}

// 语言切换：只写 storage，页面因为 t() 读的是同一个 ref 会立刻重渲染
function pickLocale(k) {
  setLocale(k)
  uni.showToast({ title: k === 'en' ? 'Switched to English' : '已切回中文', icon: 'none' })
}

function prefClass(tg) {
  if (!tg.preference) return ''
  return 'pref-' + tg.preference
}

async function load() {
  try {
    const [p, pref] = await Promise.all([api.get('/api/user/profile'), api.get('/api/user/preferences')])
    user.value = p.user || {}
    stats.value = p.stats || stats.value
    nickname.value = p.user ? p.user.nickname || '' : ''
    tags.value = pref.tags || []
  } catch (e) {
    /* 首屏拉取失败保留上次数据 */
  }
}

async function saveNickname() {
  try {
    const d = await api.put('/api/user/profile', { nickname: nickname.value })
    user.value = d.user
    uni.setStorageSync('user', d.user)
    uni.showToast({ title: t('已保存'), icon: 'none' })
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

function choosePref(tg) {
  const options = [t('喜欢'), t('不喜欢'), t('忌口'), t('过敏'), t('清除')]
  const values = ['like', 'dislike', 'avoid', 'allergy', null]
  uni.showActionSheet({
    itemList: options,
    success: (res) => {
      tg.preference = values[res.tapIndex]
    },
  })
  // uni 的 showActionSheet 不认 cancelText 参数，取消按钮走的是 uni-h5 内置的
  // i18n 文案，语言由 uni 自己的 locale 决定，和本应用的 locale 不同步。
  // H5 下等它渲染出来后把最后一格（取消）的文案改掉。
  // #ifdef H5
  setTimeout(() => {
    const cells = document.querySelectorAll('.uni-actionsheet__cell')
    const last = cells[cells.length - 1]
    if (last && last.textContent.trim() !== t('取消')) last.textContent = t('取消')
  }, 30)
  // #endif
}

async function savePrefs() {
  const preferences = tags.value
    .filter((tg) => tg.preference)
    .map((tg) => ({ tagId: tg.id, type: tg.preference }))
  try {
    await api.put('/api/user/preferences', { preferences })
    uni.showToast({ title: t('偏好已保存'), icon: 'none' })
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

async function changePwd() {
  if (newPwd.value.length < 6) return uni.showToast({ title: t('新密码至少 6 位'), icon: 'none' })
  try {
    await api.put('/api/user/password', { oldPassword: oldPwd.value, newPassword: newPwd.value })
    oldPwd.value = ''
    newPwd.value = ''
    uni.showToast({ title: t('密码已修改'), icon: 'none' })
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

function goAdmin() { uni.navigateTo({ url: '/pages/admin/admin' }) }
function goHistory() { uni.navigateTo({ url: '/pages/history/history' }) }
function goPlan() { uni.navigateTo({ url: '/pages/plan/plan' }) }
function goEncyclopedia() { uni.switchTab({ url: '/pages/encyclopedia/encyclopedia' }) }
function goWorld() { uni.switchTab({ url: '/pages/world/world' }) }

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
  background: #c0392f; color: #fff; font-size: 44rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.stats { margin-top: 26rpx; }
.stat { flex: 1; text-align: center; }
.stat-num { display: block; font-size: 34rpx; font-weight: 700; }
.cell { display: flex; align-items: center; padding: 22rpx 0; border-bottom: 1rpx solid #f1f2f5; }
.cell:last-child { border-bottom: none; }
.tag { cursor: pointer; }
.pref-like { background: #e6f7ea; color: #1f7a33; }
.pref-dislike { background: #f1f2f5; color: #5b6470; }
.pref-avoid { background: #fff4e6; color: #b4460a; }
.pref-allergy { background: #fdeaea; color: #c0392f; }
.logout { margin-top: 10rpx; }

/* 语言切换 chip：选中实心红，未选中浅底描边。字号与 mute 文字对齐，不做成小字。 */
.lang-row { display: flex; gap: 16rpx; margin-top: 18rpx; }
.lang-chip {
  padding: 12rpx 34rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: #3b4350;
  background: #f7f7f5;
  border: 1rpx solid #d8d8d2;
  cursor: pointer;
}
.lang-on { background: #c0392f; color: #fff; border-color: #c0392f; }

/* 动效开关（与记录页的儿童模式开关同一套视觉） */
.sw {
  width: 88rpx; height: 48rpx; border-radius: 999rpx;
  background: #dcdfe6; position: relative; transition: background .2s ease;
  flex-shrink: 0;
}
.sw-on { background: #c0392f; }
.sw-dot {
  position: absolute; top: 4rpx; left: 4rpx;
  width: 40rpx; height: 40rpx; border-radius: 50%;
  background: #fff; transition: transform .2s ease;
}
</style>
