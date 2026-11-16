// 后端地址：本机开发默认 127.0.0.1:13000
// 真机调试时改成电脑的局域网 IP，例如 http://192.168.1.10:13000
export const BASE_URL = 'http://127.0.0.1:13000'

/**
 * 评级档位的中文名（审计 B4）。
 *
 * 旧版是「夯 / 顶级 / 人上人 / NPC / 拉完了」—— 后三个是网络贬义词，
 * 用户考完一场试、花了钱、认真写了评价，最后被系统告知「NPC」，
 * 而且这个档位关不掉、删不了。评级是给人看反馈的，不是给人贴标签的。
 *
 * 现在换成描述「一顿饭的量」的中性词，key 一个都没动（key 存在
 * `meal_evaluations.tier` 里，改 key 会让历史记录成孤儿）。
 * 后端 `evaluate.js` 的 `TIER_RULES` 已同步改为 v2，两边必须一致。
 */
export const TIER_LABEL = { hang: '很棒', top: '不错', elite: '一般', npc: '偏多', lame: '偏少' }
export const TIER_COLOR = { hang: '#c0392f', top: '#b07400', elite: '#2563a8', npc: '#6b7280', lame: '#5b6470' }
export const STATUS_LABEL = { pending: '待上架', on_sale: '在售', off_sale: '已下架' }
export const PREF_LABEL = { like: '喜欢', dislike: '不喜欢', avoid: '忌口', allergy: '过敏' }

/**
 * 给「用户自己上传的照片」拼图片地址（审计 B3）。
 *
 * 后端 /uploads/<文件名> 现在分两类：
 *   · 菜单菜品图 —— 公开，任何人（含未登录）都能看；
 *   · 用户上传的账单/菜品照片 —— 必须登录，且只能是上传者本人或管理员。
 * 小程序的 <image src> 没有 header，带不了 Authorization，所以后端额外接受
 * 查询参数 `?t=<token>`。**只对用户上传的照片用它**，菜单图不用，
 * 免得把 token 扩散到会被缓存/分享的图片地址里。
 */
export function authImgUrl(filePath) {
  if (!filePath) return ''
  const t = typeof uni !== 'undefined' && uni.getStorageSync ? uni.getStorageSync('token') : ''
  if (!t) return BASE_URL + filePath
  const sep = filePath.indexOf('?') >= 0 ? '&' : '?'
  return BASE_URL + filePath + sep + 't=' + encodeURIComponent(t)
}
