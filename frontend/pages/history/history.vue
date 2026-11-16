<template>
  <view class="page">
    <view class="card" v-if="filtered !== meals.length || meals.length">
      <view class="row between">
        <text class="muted">{{ t('共 {n} 条记录', { n: meals.length }) }}</text>
        <text v-if="voidCount" class="clear-link" @tap="showVoid = !showVoid" aria-role="button">
          {{ showVoid ? t('隐藏作废') : t('显示作废（{n}）', { n: voidCount }) }}
        </text>
      </view>
    </view>

    <view v-if="loading" class="empty">{{ t('加载中…') }}</view>
    <view v-else-if="!list.length" class="empty">{{ t('还没有用餐记录，去记一顿吧') }}</view>

    <view v-for="m in list" :key="m.id" :class="['card', m.status === 'void' ? 'is-void' : '']">
      <view class="row between" @tap="go(m.id)" aria-role="button">
        <text class="date">{{ fmtDate(m.eaten_at) }}</text>
        <!-- 作废优先：作废单不计入评级，即使后端仍返回 tier/score 也不显示档位 -->
        <text v-if="m.status === 'void'" class="pill void">{{ t('已作废') }}</text>
        <view
          v-else-if="m.status === 'confirmed' && m.tier && showTier"
          class="pill"
          :style="{ background: tierBg(m.tier), color: tierFg(m.tier) }"
        >{{ t('{t} · {n} 分', { t: tierLabel(m.tier), n: m.score }) }}</view>
        <!-- 审计 B4：关掉评级不等于这条记录变回草稿 -->
        <text v-else-if="m.status === 'confirmed'" class="pill draft">{{ t('已确认') }}</text>
        <text v-else class="pill draft">{{ t('草稿') }}</text>
      </view>
      <view class="row between">
        <view class="muted" style="margin-top: 10rpx" @tap="go(m.id)" aria-role="button">
          {{ t('{n} 道菜', { n: m.item_count }) }}<text v-if="m.actual_paid != null">{{ t(' · 实付 ¥{x}', { x: fmtMoney(m.actual_paid) }) }}</text>
          <text v-if="m.rating">{{ t(' · 自评 {n} 星', { n: m.rating }) }}</text>
        </view>
        <!-- 审计 B3：列表上直接能删，不用先点进详情 -->
        <text class="del-link" @tap.stop="del(m)" aria-role="button">{{ t('删除') }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../common/api.js'
import { TIER_COLOR, TIER_LABEL } from '../../common/config.js'
import { errMsg, fmtDate, fmtMoney } from '../../common/util.js'
import { showTier, syncShowTier } from '../../common/uiPrefs.js'
import { t, useLocale } from '../../common/i18n.js'

// 语言：切页时同步 storage 并重刷导航栏 / tabBar 文案
useLocale('用餐历史')

syncShowTier()

const meals = ref([])
const loading = ref(false)
const showVoid = ref(false)

const voidCount = computed(() => meals.value.filter((m) => m.status === 'void').length)
const filtered = computed(() => (showVoid.value ? meals.value : meals.value.filter((m) => m.status !== 'void')))
// 作废单默认折叠；展开时排到最后，避免与正常记录混排
const list = computed(() => {
  const arr = filtered.value.slice()
  if (showVoid.value) arr.sort((a, b) => (a.status === 'void' ? 1 : 0) - (b.status === 'void' ? 1 : 0))
  return arr
})

function tierBg(t) { return (TIER_COLOR[t] || '#6b7280') + '1a' }
function tierFg(t) { return TIER_COLOR[t] || '#6b7280' }
function tierLabel(k) { return t(TIER_LABEL[k] || k) }
function go(id) { uni.navigateTo({ url: '/pages/mealDetail/mealDetail?id=' + id }) }

/** 删除单条记录（审计 B3）。作废 ≠ 删除，这两个动作在界面上要分得开。 */
async function del(m) {
  const isVoidRow = m.status === 'void'
  const ok = await new Promise((resolve) => {
    uni.showModal({
      title: t('彻底删除这条记录'),
      content:
        fmtDate(m.eaten_at) +
        ' · ' +
        m.item_count +
        t(' 道菜。明细、评级和它带来的图鉴进度都会回滚，删了找不回来。') +
        (isVoidRow ? '' : t('如果只是不想让它计入统计，用详情页的「作废」就好。')),
      cancelText: t('取消'),
      confirmText: t('彻底删除'),
      confirmColor: '#c0392f',
      success: (r) => resolve(r.confirm),
    })
  })
  if (!ok) return
  try {
    await api.del('/api/meals/' + m.id)
    uni.showToast({ title: t('已删除'), icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  }
}

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/meals')
    meals.value = data.meals || []
  } catch (e) {
    uni.showToast({ title: errMsg(e), icon: 'none' })
  } finally {
    loading.value = false
  }
}

onShow(() => load())
</script>

<style scoped>
.date { font-size: 28rpx; font-weight: 600; }
.draft { background: #f1f2f5; color: #5b6470; }
.void { background: #fdeaea; color: #c0392f; }
.is-void { opacity: 0.62; }
.clear-link { color: #2563a8; font-size: 24rpx; }
.del-link { font-size: 24rpx; color: #a8443f; padding: 8rpx 0; }
</style>
