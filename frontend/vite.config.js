import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

// @dcloudio/vite-plugin-uni 是 CJS 包，在本项目（"type": "module"）里
// 用 ESM 默认导入拿到的是 { default: fn } 的包装，直接调用会报
// "uni is not a function"。这里两种形态都兼容一下。
const uni = typeof uniModule === 'function' ? uniModule : uniModule.default

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [uni()],
})
