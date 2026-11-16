import { ref } from 'vue'
import { t } from './i18n.js'

/**
 * 界面显示偏好（审计 B4）。
 *
 * 为什么要有「关掉评级」这个开关：
 * 档位词已经从「夯 / 人上人 / NPC / 拉完了」换成中性词（很棒 / 不错 / 一般 / 偏多 / 偏少），
 * 但换个说法不等于问题解决 —— 它的本质仍然是「用一个分数给一顿饭下定义」。
 * 有人就是不想被这样评价，而原版连关都关不掉。这是显示层的事，
 * 所以开关只影响渲染，数据库里的 score / tier 一个字都不动。
 *
 * 默认开（true）：关掉评级会让「历史记录回看」少了主要信息，
 * 所以不替用户做这个决定，但要给它一个明确的出口。
 */
const TIER_KEY = 'showTier'

export const showTier = ref(true)

export function syncShowTier() {
  try {
    const v = uni.getStorageSync(TIER_KEY)
    // 没存过时 getStorageSync 返回 ''，不能直接当 false 用
    showTier.value = v === '' || v == null ? true : v === true
  } catch {
    showTier.value = true
  }
}

export function toggleShowTier() {
  showTier.value = !showTier.value
  try {
    uni.setStorageSync(TIER_KEY, showTier.value)
  } catch {
    /* 存不进去也不影响本次会话 */
  }
  uni.showToast({ title: showTier.value ? t('已显示评级') : t('已隐藏评级'), icon: 'none' })
  return showTier.value
}
