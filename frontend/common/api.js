import { BASE_URL } from './config.js'

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
          reject(new Error(body && body.message ? body.message : '登录已过期'))
        } else {
          reject(new Error((body && body.message) || '请求失败 ' + res.statusCode))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络异常')),
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
    if (!fs) return reject(new Error('当前环境不支持读取图片，请用微信小程序调试'))
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (r) => resolve(r.data),
      fail: (e) => reject(new Error((e && e.errMsg) || '读取图片失败')),
    })
  })
}

/** 上传图片，返回 { id, path, type } */
export async function uploadImage(type, filePath) {
  const dataBase64 = await fileToBase64(filePath)
  return request('/api/uploads', { method: 'POST', data: { type, dataBase64 } })
}
