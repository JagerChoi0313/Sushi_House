# 任务：爬取寿司郎官网菜单（名字 / 价格 / 图片）并导入 Sushi_House 数据库

> 这是一份可直接执行的完整任务书。所有 URL、正则、字段名、路径都已在真实环境验证过，照做即可。
> 唯一需要你自己判断的是「哪些菜要、怎么归类」，其余全是确定动作。

---

## 0. 一句话目标

把**寿司郎台湾官网**的 249 道菜（名字 + 价格 + 图片）抓下来，图片落到 `uploads/`，记录写进
`Sushi_House/database/sushi_house.db` 的 `dishes` 表，最后让前端菜单页能看到菜图。

---

## 1. 环境与路径（照抄，别改）

| 项 | 值 |
|---|---|
| 项目根 | `D:\ai\工作区\dsh\小组作业\Sushi_House` |
| 数据库 | `D:\ai\工作区\dsh\小组作业\Sushi_House\database\sushi_house.db` |
| 图片目录 | `D:\ai\工作区\dsh\小组作业\Sushi_House\backend\uploads`（后端会自动建） |
| 建表语句 | `D:\ai\工作区\dsh\小组作业\Sushi_House\backend\schema.sql` |
| 后端服务 | `node --disable-warning=ExperimentalWarning src/server.js`（在 `backend/` 下跑，端口 13000） |
| Node 版本 | ≥ 22.5（必须，因为用内置 `node:sqlite` 的 `DatabaseSync`，**零依赖**，不要 `npm i better-sqlite3`） |

**写脚本的地方**：`D:\ai\工作区\dsh\小组作业\Sushi_House\_scrape\`（自己建，别污染 `backend/`）。

---

## 2. 数据源（关键：只有台湾站能抓）

### 2.1 已验证可用的唯一入口

```
https://www.sushiro.com.tw/Menu
```

返回 HTTP 200，约 114,937 字节，**菜品数据直接写在 HTML 里**（不是 JS 渲染），正则就能抓。

### 2.2 已确认不可用的站（别浪费时间）

| URL | 结果 |
|---|---|
| `https://www.sushiro.com.cn/` | 连接超时 |
| `https://www.sushiro.com.cn/menu` | 连接超时 |
| `https://www.sushiro.cn/` | DNS 无法解析 |
| `http://www.sushiro.com.cn/` | 200，但只有 587 字节 ICP 备案占位页（`粤ICP备2021070706号`），无菜单 |
| `https://sushiro.com.cn/` | SSL 证书不受信 |
| `www.sushiro.com.hk` | DNS 无法解析 |
| `https://www.akindo-sushiro.co.jp/menu/` | 200 / 133,050 字节，但 HTML 里**搜不到 `サーモン`** —— 菜单是 JS 渲染，纯 HTTP 抓不到 |

**结论：只用 `https://www.sushiro.com.tw/Menu`。**

### 2.3 分类 URL 是个陷阱

页面上有 8 个 `/Menu?name=xxx` 形式的分类链接，但**服务端不按分类过滤** —— 8 个 URL 全都返回
同一份 249 道菜。所以：

- **不要**循环请求 8 个分类 URL（只会拿到 8 份完全一样的数据）
- 只请求一次 `/Menu`，分类信息靠 HTML 里的 `<h2>/<h3>/<h4>` 标题分组

---

## 3. HTML 解析规则（已实测，249/249 全部命中）

### 3.1 每道菜是一个 `div.sushi-box`

切块正则：

```js
const BLOCK = /<div class="sushi-box">[\s\S]*?(?=<div class="sushi-box">|<\/div>\s*<\/div>\s*<\/div>)/g;
```

实测切出 **249** 块。

### 3.2 块内取四个字段

| 字段 | 正则 | 实测 |
|---|---|---|
| 菜名 | `class="sushi-name">([^<]*)<` | 249/249 非空 |
| 价格 | `class="sushi-price">([^<]*)<` | 249/249 非空，格式统一 `NN元`（全部匹配 `^\d+元$`） |
| 图片 | `<div class="sushi">\s*<img src="([^"]+)"` | 路径形如 `/Upload/Dish/<uuid>.png` |
| 限量标记 | `class="limited"` | 共 19 处，是「期間限定」的意思 |

**图片 URL 补全**：`'https://www.sushiro.com.tw' + imgPath` 直接 GET 即可，实测
`200 / Content-Type: image/png / magic 89 50 4e 47 0d 0a 1a 0a`。

### 3.3 分类分组（按 `<h2|h3|h4>` 切段，合计 249）

实测各段菜品数：

```
外帶菜單      84
握壽司40元    36
期間限定      19
握壽司50元    17
軍艦          16
握壽司60元    16
甜點          12
湯類          11
飲料           9
握壽司80元     9
卷類           7
握壽司70元     5
麵類           4
握壽司30元     4
```

分组写法：

```js
const parts = html.split(/(?=<h[234][^>]*>)/);
let cur = '(顶部)';
const groups = new Map();          // 分类名 -> 菜品数组
for (const p of parts) {
  const m = /<h[234][^>]*>([^<]{1,30})<\/h[234]>/.exec(p);
  if (m) cur = m[1].trim();
  const blocks = p.match(BLOCK) || [];
  if (blocks.length) groups.set(cur, (groups.get(cur) || []).concat(blocks));
}
```

---

## 4. 数据必须先看清这 4 个坑（决定了你的导入策略）

### 坑 1：249 条记录，但菜名唯一值只有 **172** 个

同名菜会出现在多个价格段（`握壽司40元` / `50元` / `60元` 各段都有「鮭魚」之类）。
→ **不要盲目 249 条全插**，否则库里会出现一堆同名不同价的重复菜。
建议：以 `(name + price)` 做联合去重，或按 `name` 只保留最低价那条。

### 坑 2：价格是 **新台币（NTD）**，不是人民币

`60元` = NT$60 ≈ ¥13.6。项目现有 22 道菜的价格是**人民币**（¥6–¥32）。
→ 必须换算，否则一道菜显示 ¥60 会被当成人民币，贵 4 倍多。

**建议换算**：按 1 NTD ≈ 0.227 CNY（写死一个常量并注释来源），或者干脆按价格档位映射
（30/40/50/60/70/80 元 → ¥7/9/11/14/16/18），保持整数好看。

### 坑 3：图片总体积 ≈ **39 MB**

抽样 4 张：237,332 B / 112.9 KB / 186 KB / 184.6 KB，平均 **161 KB**，× 249 ≈ **39.2 MB**。
→ 下载时：并发 ≤ 4、每张之间 `await sleep(150ms)`，别把人家网站打挂；
→ 下载完做一次瘦身（`sharp` 或系统自带工具缩到 800px 宽），否则 39 MB 静态目录很笨。

### 坑 4：现有 22 道菜的 `image` **全是 NULL**

`dishes` 表里 id 1–22 的 22 条老数据（三文鱼寿司 / 金枪鱼寿司 / … / 旧款花之恋）**一张图都没有**。
→ 你可以选择：
- (a) 保留老 22 条，只往里补 `image`（按菜名模糊匹配）
- (b) 保留老 22 条不动，新菜作为新行追加（推荐，风险最低）
- (c) 清空重来（会连带清掉 `dish_tags`，因为 `ON DELETE CASCADE`，谨慎）

**推荐 (b)**：老数据不动，新菜追加，最后在菜单页按 `category_id` 排序展示。

---

## 5. 目标数据库结构（照抄字段名，别自创）

```sql
-- 已有表，别改结构
CREATE TABLE dishes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER REFERENCES dish_categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  image         TEXT,                      -- 存 '/uploads/xxx.png' 相对路径
  price         REAL NOT NULL DEFAULT 0,
  calories      REAL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'on_sale'
                CHECK(status IN ('pending','on_sale','off_sale')),
  expected_date TEXT,
  created_at    TEXT,
  updated_at    TEXT
);

CREATE TABLE dish_categories (id, name UNIQUE, sort_order, status, created_at);
CREATE TABLE tags (id, name UNIQUE, type TEXT DEFAULT 'ingredient', color, created_at);
-- type: 'ingredient' 食材 | 'flavor' 口味
CREATE TABLE dish_tags (
  id, dish_id REFERENCES dishes ON DELETE CASCADE,
  tag_id REFERENCES tags ON DELETE CASCADE, UNIQUE(dish_id, tag_id)
);
```

### 5.1 现有分类（`dish_categories` 6 行）

```
1 寿司   sort_order 0
2 刺身   sort_order 1
3 天妇罗 sort_order 2
4 小食   sort_order 3
5 甜点   sort_order 4
6 饮品   sort_order 5
```

寿司郎的分类（握壽司 / 軍艦 / 卷類 / 麵類 / 湯類 / 甜點 / 飲料 / 期間限定）**对不上**这 6 个。
→ 两个选择：
- (a) 按语义映射：握壽司→寿司(1)、軍艦→寿司(1)、卷類→寿司(1)、麵類→小食(4)、湯類→小食(4)、甜點→甜点(5)、飲料→饮品(6)、期間限定→按具体菜判断
- (b) 新增分类行（`INSERT INTO dish_categories(name, sort_order, status) VALUES(...)`），保留原 6 个

**推荐 (a)**：不破坏现有前端筛选逻辑（菜单页的分类 tab 是硬编码读 `dish_categories` 的）。

### 5.2 现有标签（`tags` 18 行）

```
食材(ingredient)：1 三文鱼  2 金枪鱼  3 虾    4 鸡蛋  5 小麦
                  6 乳制品  7 油炸    8 生食  9 黄瓜  10 牛油果
                  11 蟹肉   12 鳗鱼   13 海苔
口味(flavor)：   14 鲜     15 甜     16 咸   17 酸   18 苦
```

→ 爬到的菜没有标签信息，你可以按菜名关键词自动打标（如名字含「鮭」→ 三文鱼、「エビ/蝦」→ 虾），
也可以留空。**留空不影响功能**（`attachTags` 会返回空数组）。

---

## 6. 两条写入通道（任选，推荐 A）

### A. 直连 SQLite（最简单，推荐）

```js
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('D:/ai/工作区/dsh/小组作业/Sushi_House/database/sushi_house.db');
db.prepare(`INSERT INTO dishes (category_id,name,image,price,calories,description,status,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))`)
  .run(catId, name, '/uploads/' + fileName, priceCNY, null, desc, 'on_sale');
```

注意：**先停后端再直连写**，或者写完跑一次 `PRAGMA wal_checkpoint(TRUNCATE)`，否则 WAL 里的
数据别的工具读不到（这个项目踩过坑）。

### B. 走后端 HTTP API（要鉴权，但更"正规"）

1. 登录拿 token：
```http
POST http://127.0.0.1:13000/api/auth/login
Content-Type: application/json

{"username":"admin","password":"admin123"}
```
→ `{"code":0,"message":"ok","data":{"token":"<token>","user":{...}}}`

2. 建菜：
```http
POST http://127.0.0.1:13000/api/admin/dishes
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": 1,
  "name": "鮭魚握壽司",
  "image": "/uploads/sushi-001.png",
  "price": 9,
  "calories": 45,
  "description": "寿司郎官网 · 握壽司40元",
  "status": "on_sale",
  "tagIds": [1, 8]
}
```
→ `{"code":0,"data":{"dish":{...}}}`

**handler 源码位置**：`backend/src/routes.js:548` `adminCreateDish({db, body, res})`，
INSERT 字段固定为 `(category_id, name, image, price, calories, description, status, expected_date)`，
body 键名是 `categoryId / name / image / price / calories / description / status / expectedDate / tagIds[]`。

**注意**：API 走 `INSERT` 不去重，重复调用会产生重复行 —— 自己去重。

---

## 7. 图片怎么落盘

后端静态目录是 `backend/uploads/`（`backend/src/db.js:12` `UPLOAD_DIR = path.join(PROJECT_DIR,'uploads')`），
`backend/src/server.js:79-81` 用 `pathname.startsWith('/uploads/')` + `path.basename(rel)` 托管。

**做法**：
1. `mkdirSync(UPLOAD_DIR, { recursive: true })`
2. 文件名自己起（别用原 uuid，太难认）：`sushi-<序号>.png` 或 `slug(菜名).png`
3. `writeFileSync(path.join(UPLOAD_DIR, fileName), buf)`
4. `dishes.image` 存 `'/uploads/' + fileName`（**相对路径，不要存绝对路径**）

**不要**用 `POST /api/uploads` —— 那个接口是给「用餐照片」用的，需要 `auth:'user'`，
而且会往 `meal_uploads` 表写一行无关记录。

---

## 8. 前端必须跟着改（否则图存了也看不见）

**现状**：`frontend/pages/menu/menu.vue` 的菜品卡只渲染 `{{ d.name }}` / 价格 / 热量 / 标签，
**全项目只有一个 `<image>`，在 `frontend/pages/mealDetail/mealDetail.vue:40`**（那是用餐照片）。

必须改这三处，加上菜品图：

| 文件 | 要加的东西 |
|---|---|
| `frontend/pages/menu/menu.vue` | 卡片左侧/顶部加 `<image :src="BASE_URL + d.image" mode="aspectFill" />`，`v-if="d.image"` |
| `frontend/pages/encyclopedia/encyclopedia.vue` | 图鉴卡片同样加图 |
| `frontend/pages/admin/admin.vue` | 后台列表加缩略图 |

**关键**：`d.image` 存的是 `/uploads/xxx.png`（相对），必须拼 `BASE_URL`。
`BASE_URL` 来自 `frontend/common/config.js`，值是 `http://127.0.0.1:13000`。

```html
<image v-if="d.image" :src="BASE_URL + d.image" mode="aspectFill" class="dish-img" />
```
```js
import { BASE_URL } from '@/common/config.js';
```

注意小程序端 `<image>` 默认有尺寸（320×240），要自己写 CSS 定宽高，否则会把卡片撑变形。

---

## 9. 执行步骤（按顺序，每步都要验证）

### 步骤 1 — 抓 HTML 并落盘（先别解析）

```js
const res = await fetch('https://www.sushiro.com.tw/Menu', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36' }
});
const html = await res.text();
fs.writeFileSync('_scrape/menu.html', html, 'utf8');
```

**验证**：文件大小应 ≈ 114,937 字节；`html.match(/class="sushi-box"/g).length === 249`。

### 步骤 2 — 解析成 JSON（先不下载图）

输出 `_scrape/menu.json`，结构：

```json
[
  { "group": "握壽司40元", "name": "鮭魚", "priceText": "40元", "priceNtd": 40, "imgPath": "/Upload/Dish/xxx.png", "limited": false }
]
```

**验证**：
- 总条数 = **249**
- 菜名非空 = 249
- 价格全部匹配 `^\d+元$` = 249
- 唯一菜名数 = **172**（对不上说明正则错了）
- `limited` 数量 = **19**

### 步骤 3 — 去重 + 换算价格

自己定策略（建议 `name` 去重取最低价），产出 `_scrape/import.json`：

```json
[
  { "name": "鮭魚握壽司", "priceNtd": 40, "priceCny": 9, "categoryId": 1, "imgPath": "/Upload/Dish/xxx.png", "source": "寿司郎官网 · 握壽司40元" }
]
```

**验证**：条数应 ≈ 172（或你策略下的合理值），`priceCny` 全部 > 0。

### 步骤 4 — 下载图片

并发 4，每张间隔 150ms，落到 `backend/uploads/sushi-<序号>.png`。

**验证**：
- 文件数 = import.json 条数
- 每张首 8 字节 = `89 50 4e 47 0d 0a 1a 0a`（PNG magic）
- 没有 0 字节文件
- 总大小 ≈ 39 MB（若明显偏小说明有失败）

### 步骤 5 — 写库

**先停后端**（`Stop-Process` 掉 13000 端口那个 node），再直连 SQLite 写，写完：

```js
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
```

**验证**：

```sql
SELECT COUNT(*) FROM dishes;                              -- 22 + 新增数
SELECT COUNT(*) FROM dishes WHERE image IS NOT NULL;      -- 应等于新增数
SELECT id,name,price,image FROM dishes ORDER BY id DESC LIMIT 5;
```

### 步骤 6 — 重启后端 + 肉眼验证

```powershell
cd D:\ai\工作区\dsh\小组作业\Sushi_House\backend
node --disable-warning=ExperimentalWarning src/server.js
```

- `http://127.0.0.1:13000/api/dishes` 返回的 `data.dishes` 里每条都有 `image`
- 浏览器直接访问 `http://127.0.0.1:13000/uploads/sushi-001.png` 能看到图
- 前端菜单页（`_h5run` 跑在 `http://localhost:5180/`，或你自己起）能看到菜图

---

## 10. 验收清单（全部打勾才算完）

- [ ] `_scrape/menu.html` ≈ 114,937 字节
- [ ] 解析出 **249** 条，菜名/价格非空率 100%
- [ ] 唯一菜名 **172** 个
- [ ] `limited` **19** 个
- [ ] `_scrape/import.json` 每条都有 `name` / `priceCny` / `categoryId` / `imgPath`
- [ ] `backend/uploads/` 图片数量 = 导入条数，全部 PNG magic 正确，无 0 字节
- [ ] `dishes` 表新增行数 = 导入条数，`image` 全部非 NULL
- [ ] 老 22 条数据**未被破坏**（`SELECT COUNT(*) FROM dishes WHERE id<=22` 仍 = 22）
- [ ] `PRAGMA wal_checkpoint(TRUNCATE)` 已跑
- [ ] `/api/dishes` 返回带 image
- [ ] 前端菜单页能看到菜图，且图片不变形

---

## 11. 报告格式（做完按这个回话）

```
## 抓取结果
- 数据源：https://www.sushiro.com.tw/Menu（HTML 114,937 B）
- 抓到：249 条 / 唯一菜名 172 / 限量标记 19
- 分类分布：外帶菜單84 握壽司40元36 期間限定19 ...

## 导入结果
- 去重策略：<你用的策略>
- 新增菜品：<N> 条（categoryId 分布：寿司X 刺身X 小食X 甜点X 饮品X）
- 价格换算：1 NTD = <你用的汇率> CNY
- 图片：<N> 张 / <X> MB / 全部 PNG 校验通过

## 数据库
- dishes 总数：<22+N>
- image 非空：<N>
- 老数据完整性：id 1-22 仍 22 条 ✅

## 前端
- 改了 menu.vue / encyclopedia.vue / admin.vue 的图片渲染
- 截图：<贴图>

## 遗留
- <没做的 / 做不动的>
```

---

## 12. 硬性约束（违反即返工）

1. **只抓 `www.sushiro.com.tw/Menu` 这一个 URL**，别去试国内站（全部超时/占位页）。
2. **不要循环请求 8 个 `/Menu?name=` 分类 URL** —— 返回的是同一份数据，白跑 8 次。
3. **不要把新台币价格当人民币直接存** —— 必须换算或按档位映射，并在报告里写清汇率。
4. **不要清空 `dishes` 表** —— 会级联删掉 `dish_tags`，老 22 条是演示数据，必须保留。
5. **`dishes.image` 只存相对路径 `/uploads/xxx.png`**，不要存绝对路径或 `http://` 全 URL。
6. **写库前先停后端，写完 `PRAGMA wal_checkpoint(TRUNCATE)`** —— 否则 WAL 数据别的工具读不到。
7. **图片下载并发 ≤ 4、间隔 ≥ 150ms** —— 别把人家官网打挂。
8. **不要用 `POST /api/uploads`** —— 那是用餐照片接口，会污染 `meal_uploads`。
9. 只改这三个前端文件：`menu.vue` / `encyclopedia.vue` / `admin.vue`，别动 `pages.json` 路由。
10. 用内置 `node:sqlite`，**不要 `npm i` 任何数据库包**。
