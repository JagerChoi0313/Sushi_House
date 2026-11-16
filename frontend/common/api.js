import { BASE_URL } from './config.js'
import { t } from './i18n.js'

// 后端没起来时，页面会安静地显示「0 道 / 0/0 图鉴 / 没有找到菜品」，
// 看着像功能坏了，其实是连不上服务。这里做一次统一提示，5 秒内只提醒一次，
// 免得一个页面上四五个请求同时失败就弹四五个 toast。
let lastOfflineTip = 0
function tipOffline() {
  const now = Date.now()
  if (now - lastOfflineTip < 5000) return
  lastOfflineTip = now
  uni.showToast({
    title: t('连不上后端，请先启动服务'),
    icon: 'none',
    duration: 2500,
  })
}

export function request(path, { method = 'GET', data, auth = true } = {}) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' }
    const token = uni.getStorageSync('token')
    if (auth && token) header['Authorization'] = 'Bearer ' + token

    uni.request({
      url: BASE_URL + path,
      method,
      data,
      header,
      success: (res) => {
        const body = res.data
        if (body && body.code === 0) {
          resolve(body.data)
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token')
          uni.reLaunch({ url: '/pages/login/login' })
          reject(new Error(body && body.message ? body.message : t('登录已过期')))
        } else {
          reject(new Error((body && body.message) || t('请求失败 {n}', { n: res.statusCode })))
        }
      },
      fail: (err) => {
        // errMsg 形如 "request:fail" 或 "request:fail timeout"，都表示没连上
        tipOffline()
        reject(new Error(t('连不上后端，请确认服务已启动（{m}）', { m: err.errMsg || t('网络异常') })))
      },
    })
  })
}

export const api = {
  get: (path, opts = {}) => request(path, { ...opts, method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', data }),
  put: (path, data) => request(path, { method: 'PUT', data }),
  del: (path) => request(path, { method: 'DELETE' }),
}

/** 读取图片为 base64（微信小程序 / App 可用；H5 请用真机或小程序调试） */
export function fileToBase64(filePath) {
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager && uni.getFileSystemManager()
    if (!fs) return reject(new Error(t('当前环境不支持读取图片，请用微信小程序调试')))
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (r) => resolve(r.data),
      fail: (e) => reject(new Error((e && e.errMsg) || t('读取图片失败'))),
    })
  })
}

/** 上传图片，返回 { id, path, type } */
export async function uploadImage(type, filePath) {
  const dataBase64 = await fileToBase64(filePath)
  return request('/api/uploads', { method: 'POST', data: { type, dataBase64 } })
}
