-- ============================================================
-- 寿司朗点餐测评系统 v1 · SQLite 数据库结构
-- 幂等：全部使用 CREATE TABLE IF NOT EXISTS，可重复执行
-- ============================================================
PRAGMA foreign_keys = ON;

-- 1. 用户 ----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,                    -- 格式：salt:scryptHash
  nickname      TEXT,
  avatar        TEXT,
  role          TEXT    NOT NULL DEFAULT 'user',     -- user | admin
  status        INTEGER NOT NULL DEFAULT 1,          -- 1 正常 / 0 禁用
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 2. 登录会话 ------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 3. 标签 ----------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  type       TEXT    NOT NULL DEFAULT 'ingredient',  -- ingredient 食材 | flavor 口味
  color      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 4. 用户偏好（按标签） --------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL CHECK (type IN ('like','dislike','avoid','allergy')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(user_id, tag_id)
);

-- 5. 菜品分类 ------------------------------------------------
CREATE TABLE IF NOT EXISTS dish_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 6. 菜品 ----------------------------------------------------
CREATE TABLE IF NOT EXISTS dishes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER REFERENCES dish_categories(id) ON DELETE SET NULL,
  name          TEXT    NOT NULL,
  image         TEXT,
  price         REAL    NOT NULL DEFAULT 0,           -- 单价（元）
  calories      REAL,                                 -- 每份热量（kcal，可空）
  description   TEXT,
  status        TEXT    NOT NULL DEFAULT 'on_sale'
                CHECK (status IN ('pending','on_sale','off_sale')),
  expected_date TEXT,                                 -- 待上架预计日期
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_status ON dishes(status);

-- 7. 菜品-标签关系 -------------------------------------------
CREATE TABLE IF NOT EXISTS dish_tags (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(dish_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_dish_tags_tag ON dish_tags(tag_id);

-- 8. 餐前计划 ------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plans (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget               REAL    NOT NULL,
  calorie_limit        REAL,
  preferences_snapshot TEXT,                          -- 生成时偏好 JSON
  estimated_price      REAL    NOT NULL DEFAULT 0,
  estimated_calories   REAL    NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user ON meal_plans(user_id);

-- 9. 计划中的菜品 --------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plan_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_plan_id  INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  dish_id       INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name     TEXT    NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    REAL    NOT NULL DEFAULT 0,
  unit_calories REAL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan ON meal_plan_items(meal_plan_id);

-- 10. 餐后记录 -----------------------------------------------
CREATE TABLE IF NOT EXISTS meals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id     INTEGER REFERENCES meal_plans(id) ON DELETE SET NULL,
  eaten_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  actual_paid REAL,                                   -- 账单实付
  rating      INTEGER,                                -- 1-5 星
  comment     TEXT,
  status      TEXT    NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','confirmed','void')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_status ON meals(status);

-- 11. 餐后确认的菜品 -----------------------------------------
CREATE TABLE IF NOT EXISTS meal_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id       INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  dish_id       INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name     TEXT    NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    REAL    NOT NULL DEFAULT 0,
  unit_calories REAL,
  source        TEXT    NOT NULL DEFAULT 'manual'
                CHECK (source IN ('photo','ocr','manual')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_dish ON meal_items(dish_id);

-- 12. 照片 / 账单上传 ----------------------------------------
CREATE TABLE IF NOT EXISTS meal_uploads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id    INTEGER REFERENCES meals(id) ON DELETE CASCADE,   -- 允许先上传、后关联餐记录
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL CHECK (type IN ('dish','bill')),
  file_path  TEXT    NOT NULL,
  ocr_status TEXT    NOT NULL DEFAULT 'none',         -- none | pending | done | failed
  ocr_result TEXT,                                    -- JSON
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_meal_uploads_meal ON meal_uploads(meal_id);

-- 13. 用餐测评 -----------------------------------------------
CREATE TABLE IF NOT EXISTS meal_evaluations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id            INTEGER NOT NULL UNIQUE REFERENCES meals(id) ON DELETE CASCADE,
  estimated_price    REAL,
  estimated_calories REAL,
  score              REAL,
  tier               TEXT,                            -- hang | top | elite | npc | lame
  basis              TEXT,                            -- JSON 评级依据
  rule_version       TEXT    NOT NULL DEFAULT 'v1',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 14. 勋章规则 -----------------------------------------------
CREATE TABLE IF NOT EXISTS badge_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  type           TEXT    NOT NULL DEFAULT 'milestone'
                 CHECK (type IN ('unlock','milestone')),
  dish_id        INTEGER REFERENCES dishes(id) ON DELETE CASCADE,
  tag_id         INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  required_count INTEGER NOT NULL DEFAULT 1,
  name           TEXT    NOT NULL,
  image          TEXT,
  description    TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 15. 用户勋章 -----------------------------------------------
CREATE TABLE IF NOT EXISTS user_badges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_rule_id INTEGER NOT NULL REFERENCES badge_rules(id) ON DELETE CASCADE,
  awarded_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(user_id, badge_rule_id)
);

-- 16. 用户菜品图鉴进度 ---------------------------------------
CREATE TABLE IF NOT EXISTS user_dish_progress (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id        INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  eat_count      INTEGER NOT NULL DEFAULT 0,          -- 吃过几次（每餐算 1 次）
  portion_count  INTEGER NOT NULL DEFAULT 0,          -- 共吃了几份
  first_eaten_at TEXT,
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(user_id, dish_id)
);
