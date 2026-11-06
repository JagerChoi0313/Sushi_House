# 寿司朗点餐测评系统

> 优化预算、判断口味，以最低的成本得到良好的用餐体验。

一个「单人用餐规划 + 餐后测评 + 寿司图鉴勋章」小程序。
前端 **Uni-app + Vue3（HBuilderX）**，后端 **Node.js 零依赖**，数据库 **SQLite**。

## 目录结构

```
Sushi_house/
├── database/                # SQLite 数据库文件（sushi_house.db）
├── uploads/                 # 上传的照片（运行时生成）
├── backend/                 # Node.js 零依赖后端
│   ├── schema.sql           # 建表 SQL
│   ├── package.json
│   └── src/
│       ├── server.js        # HTTP 服务入口（默认 127.0.0.1:13000）
│       ├── routes.js        # REST 路由
│       ├── db.js            # 数据库连接 / 初始化
│       ├── auth.js          # 密码哈希 / 令牌
│       ├── recommend.js     # 餐前推荐算法
│       ├── evaluate.js      # 评级 / 图鉴进度 / 勋章
│       ├── seed.js          # 种子数据
│       └── init_db.js       # 建库建表脚本
├── frontend/                # Uni-app(Vue3) 小程序
│   ├── pages.json / manifest.json / App.vue / main.js
│   ├── common/              # api / config / util
│   └── pages/               # login / index / menu / plan / record / ...
├── docs/DESIGN.md           # 功能与数据设计文档
└── README.md
```

## 快速开始

### 1. 启动后端

需要 **Node.js ≥ 22.5**（推荐 24，内置 `node:sqlite`，无需安装任何依赖）。

```bash
cd backend
npm install        # 无需依赖，可跳过
npm run init       # 建库建表 + 写入种子数据（可重复执行）
npm start          # 启动：http://127.0.0.1:13000
```

> 如果 3000 端口被占用/保留，本项目的默认端口已改为 **13000**。
> 如需改用其他端口：`set PORT=13001 && npm start`（PowerShell：`$env:PORT=13001; npm start`）。

### 2. 打开前端

1. 用 **HBuilderX** 打开 `frontend/` 目录（文件 → 打开目录）。
2. 运行 → 运行到小程序模拟器 → 微信开发者工具（或运行到浏览器预览 H5）。
3. 微信开发者工具里勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」，否则 `127.0.0.1` 请求会被拦截。

前端请求地址在 `frontend/common/config.js` 的 `BASE_URL`，默认 `http://127.0.0.1:13000`。
**真机调试**时改成电脑的局域网 IP（如 `http://192.168.1.10:13000`），并确保手机与电脑同一网络。

### 3. 演示账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 | `admin` | `admin123` |
| 演示食客 | `demo` | `demo123` |

`demo` 已预置偏好、2 条用餐记录、图鉴进度与勋章，可直接查看效果。

## 功能一览

- **账号与偏好**：注册 / 登录 / 退出、改昵称、改密码；喜欢 / 不喜欢 / 忌口 / 过敏四类偏好。
- **菜单与新品预告**：搜索、分类筛选、在售 / 待上架 / 已下架、价格 / 热量 / 标签。
- **餐前推荐**：输入预算 + 可选热量上限，自动排除忌口/过敏、按喜欢加权排序、在预算与热量内组合菜品，落库为「计划」。
- **餐后记录**：手动录入 / 照片识别（模拟 OCR，可改草稿）、实付金额、1–5 星自评、短评。
- **用餐测评与历史**：系统独立生成「夯 / 顶级 / 人上人 / NPC / 拉完了」五档评级，展示预算 / 热量达成与口味匹配。
- **寿司图鉴与勋章**：首次确认解锁图鉴；累计次数达阈值发放里程碑勋章（如「天妇罗达人」= 油炸标签 15 次）；作废记录自动回收进度与勋章。
- **管理后台**：菜品增删改、分类 / 标签新增、勋章门槛新增。

## 数据库（16 张表）

`users` `sessions` `tags` `user_preferences` `dish_categories` `dishes` `dish_tags`
`meal_plans` `meal_plan_items` `meals` `meal_items` `meal_uploads` `meal_evaluations`
`badge_rules` `user_badges` `user_dish_progress`

字段与规则详见 [docs/DESIGN.md](docs/DESIGN.md)。

## 说明与边界

- 后端零依赖：仅用 Node 内置 `http` / `node:sqlite` / `crypto`，**无需 `npm install`**。
- 账单 OCR / 照片估价为**模拟识别**：上传后返回一份可编辑草稿，接入真实 OCR / 视觉服务即可替换 `src/routes.js` 里的 `mockRecognize`。
- 图片上传走 base64（前端 `readFile` → 后端落盘 `uploads/`），上传文件通过 `/uploads/<file>` 静态访问。
- 第一版按单人用餐、单套菜单设计。
- 端口、域名、真机 IP 等配置见上文。
