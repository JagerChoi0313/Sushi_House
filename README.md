# 寿司朗点餐测评系统

> 优化预算、判断口味，以最低的成本得到良好的用餐体验。

一个「单人用餐规划 + 餐后测评 + 寿司图鉴勋章」小程序。
前端 **Uni-app + Vue3（HBuilderX）**，后端 **Node.js 零依赖**，数据库 **SQLite**。

> **要接手全部采集资料？只读一个文件：[`catalog_all/ASSETS.md`](catalog_all/ASSETS.md)**
> 它含项目根路径、3090 个文件的入口索引、七地区数据字段对照、数据库表与接口清单、三条自检命令、换手必踩的字段陷阱。机器可读清单是 `catalog_all/manifest.csv`。

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
│   └── pages/               # login / index / menu / world / plan / record / ...
├── catalog/ catalog_jp/ catalog_kr/ catalog_hk/   # 七地区菜单与单品图
├── catalog_sg/ catalog_my/ catalog_id/            # 仅整张菜单图（无单品图）
├── catalog_all/             # 七地区汇总：all_dishes7.* / world_dishes.* / ASSETS.md / manifest
├── _scrape/                 # 采集与转换脚本（可重跑）
│   ├── *.mjs *.py           # 137 个 mjs + 14 个 py
│   ├── _intermediate/       # 中间产物（menu.html / menu.json / import.json …）
│   └── alt_sources/         # 官网原始快照（HTML / PDF / 未引用图）
├── _archives/               # 5 个打包 ZIP（含旧项目副本），约 572 MB
├── _legacy/export/          # 台湾站早期导出（507 文件，MD5 全被 catalog/ 覆盖）
├── _shots/                  # 验收截图与拼图（42 张）
├── docs/                    # DESIGN.md + 原始采集任务书
├── _h5run/                  # frontend 的独立 H5 dev 副本（端口 5180，node_modules 为 junction）
├── menu_preview.html        # 七地区 1525 道单文件预览页（图片走相对路径）
└── README.md
```

> **目录约定**：`catalog*` / `_scrape/alt_sources` / `_scrape/_intermediate` / `_legacy` / `_archives` / `_shots` / `_h5run` / `menu_preview.html` 均为大体积采集数据与本地运行副本，已在 `.gitignore` 中排除，按需从 `_archives/sushiro_global_all7.zip` 获取；代码与汇总表（`_scrape/*.mjs`、`catalog_all/`）保留入库，保证可复现。

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
- **七地区世界菜单**：台湾 / 日本 / 韩国 / 新加坡 / 马来西亚 / 印尼 / 香港 共 **1525 道**菜品（965 道带单品图），支持跨地区切换、分类筛选、多语言搜索（中/日/韩/英），点开任一道菜可看「同食材同形态」的跨地区比价。
- **餐前推荐**：输入预算 + 可选热量上限，自动排除忌口/过敏、按喜欢加权排序、在预算与热量内组合菜品，落库为「计划」。
- **餐后记录**：手动录入 / 照片识别（模拟 OCR，可改草稿）、实付金额、1–5 星自评、短评。
- **用餐测评与历史**：系统独立生成「夯 / 顶级 / 人上人 / NPC / 拉完了」五档评级，展示预算 / 热量达成与口味匹配。
- **寿司图鉴与勋章**：首次确认解锁图鉴；累计次数达阈值发放里程碑勋章（如「天妇罗达人」= 油炸标签 15 次）；作废记录自动回收进度与勋章。
- **管理后台**：菜品增删改、分类 / 标签新增、勋章门槛新增。

## 数据库（17 张表）

`users` `sessions` `tags` `user_preferences` `dish_categories` `dishes` `dish_tags`
`meal_plans` `meal_plan_items` `meals` `meal_items` `meal_uploads` `meal_evaluations`
`badge_rules` `user_badges` `user_dish_progress` `world_dishes`

`world_dishes` 是七地区菜单表（1525 行），由 `catalog_all/world_dishes.sql` 导入，与业务表 `dishes` 相互独立。
字段与规则详见 [docs/DESIGN.md](docs/DESIGN.md)。

## 说明与边界

- 后端零依赖：仅用 Node 内置 `http` / `node:sqlite` / `crypto`，**无需 `npm install`**。
- 账单 OCR / 照片估价为**模拟识别**：上传后返回一份可编辑草稿，接入真实 OCR / 视觉服务即可替换 `src/routes.js` 里的 `mockRecognize`。
- 图片上传走 base64（前端 `readFile` → 后端落盘 `uploads/`），上传文件通过 `/uploads/<file>` 静态访问。
- 七地区菜单图通过 `/worldimg/<REGION>/<文件名>` 静态访问，图片实体在 `catalog/`、`catalog_jp/`、`catalog_kr/`、`catalog_hk/` 各自目录下（只读，不占 `uploads/`）。新加坡 / 马来西亚 / 印尼三站官方只发布整张菜单图、无单品图，因此这 560 道菜在列表里显示「无单品图」占位。
- 跨地区比价按「食材 + 形态 + 调味」概念签名分组，同一组意味着同类寿司而非同一道菜（例如同为三文鱼握寿司的各地版本），比较的是同类品在当地的价格水位。
- 第一版按单人用餐、单套菜单设计。
- 端口、域名、真机 IP 等配置见上文。
