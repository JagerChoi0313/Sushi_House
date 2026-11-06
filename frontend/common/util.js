export function fmtDate(s) {
  if (!s) return ''
  return String(s).slice(0, 16)
}

export function stars(n) {
  const v = Number(n) || 0
  return '★★★★★'.slice(0, v) + '☆☆☆☆☆'.slice(0, 5 - v)
}
