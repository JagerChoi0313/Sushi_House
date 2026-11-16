import { t } from './i18n.js'
/** 公共格式化 / 小工具（纯函数，不依赖 uni，便于单测） */

export function fmtDate(s) {
  if (!s) return ''
  return String(s).slice(0, 16)
}

/** 只取日期部分 YYYY-MM-DD */
export function fmtDay(s) {
  if (!s) return ''
  return String(s).slice(0, 10)
}

/** 金额：默认保留 1 位小数，去掉无意义的 .0 */
export function fmtMoney(n, digits = 1) {
  if (n === null || n === undefined || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

/** 0~1 的比例转百分比整数 */
export function pct(ratio) {
  const v = Number(ratio)
  if (!Number.isFinite(v)) return 0
  return Math.round(Math.max(0, Math.min(1, v)) * 100)
}

export function stars(n) {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)))
  return '★★★★★'.slice(0, v) + '☆☆☆☆☆'.slice(0, 5 - v)
}

/** 把逗号串切成数组（去空、去重、保序） */
export function splitList(s) {
  if (!s) return []
  const out = []
  for (const raw of String(s).split(',')) {
    const k = raw.trim()
    if (k && out.indexOf(k) < 0) out.push(k)
  }
  return out
}

/** 统一的错误文案提取 */
export function errMsg(e, fallback) {
  // 后端返回的错误文案是中文（如「请输入大于 0 的预算」「该记录已确认」），
  // 直接抛出去英文界面就会漏中文。这里统一过一遍字典：字典里有就翻，没有就原样。
  const fb = fallback || t('操作失败')
  if (!e) return fb
  const raw = e.message || e.errMsg || fb
  return t(raw)
}

/** 统一的 toast（uni 存在时才调用，方便在纯 node 环境引用本文件） */
export function toast(title, icon = 'none') {
  if (typeof uni !== 'undefined' && uni.showToast) uni.showToast({ title: String(title || ''), icon })
}

/**
 * 繁体 → 简体（审计 B8）。
 *
 * 库里的菜名是抓来的，简繁混排：269 道在售菜里有 131 道含繁体字
 * （魚 82 道、蝦 38、鮭 27、燒 26、軍艦 25、鮪 23 …），
 * 同一个列表里「鮭魚」和「三文鱼」并排出现，读起来像两种东西。
 *
 * 这里只做**显示层**的逐字替换 —— 数据库一个字都不改（硬约束：只加数据）。
 * 表只收库里实际出现过的字（用 `_t2s.mjs` 扫出来的），不做全量繁简转换，
 * 因为菜名里的生僻字（鰤、鮟、鰈）全量转换表未必对，误转会造出假菜名。
 */
const T2S = {
  魚: '鱼', 蝦: '虾', 鮭: '鲑', 燒: '烧', 軍: '军', 艦: '舰', 鮪: '鲔',
  鮮: '鲜', 鹽: '盐', 壽: '寿', 醬: '酱', 烏: '乌', 麵: '面', 龍: '龙',
  蔥: '葱', 貝: '贝', 鰻: '鳗', 鯖: '鲭', 雞: '鸡', 鰈: '鲽', 檸: '柠',
  鱈: '鳕', 湯: '汤', 蘿: '萝', 蔔: '卜', 飯: '饭', 豬: '猪', 鯛: '鲷',
  塊: '块', 魷: '鱿', 帶: '带', 價: '价', 餅: '饼', 鰹: '鲣', 薑: '姜',
  團: '团', 級: '级', 菓: '果', 糰: '团', 麥: '麦', 葉: '叶', 單: '单',
  點: '点', 飲: '饮', 熱: '热', 烤: '烤', 產: '产', 縣: '县', 關: '关',
  西: '西', 風: '风', 上: '上', 方: '方', 溏: '溏', 蛋: '蛋', 捲: '卷',
  藏: '藏', 蘋: '苹', 楓: '枫', 煉: '炼', 鮑: '鲍', 蜆: '蚬', 鰺: '鲹',
};

/** 把菜名里的繁体字换成简体（只换表里有的字，其余原样保留） */
export function zh(s) {
  if (!s) return ''
  const str = String(s)
  let out = ''
  for (const ch of str) out += T2S[ch] || ch
  return out
}
