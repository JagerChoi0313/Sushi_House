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
export function errMsg(e, fallback = '操作失败') {
  if (!e) return fallback
  return e.message || e.errMsg || fallback
}

/** 统一的 toast（uni 存在时才调用，方便在纯 node 环境引用本文件） */
export function toast(title, icon = 'none') {
  if (typeof uni !== 'undefined' && uni.showToast) uni.showToast({ title: String(title || ''), icon })
}
