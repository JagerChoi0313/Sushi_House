import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ok, fail, round } from './util.js';
import { makePassword, checkPassword, newToken, sha256 } from './auth.js';
import { generatePlan } from './recommend.js';
import { confirmMeal, recomputeProgress, revokeUnearnedBadges } from './evaluate.js';
import { UPLOAD_DIR } from './db.js';

// ===================== 通用工具 =====================

function userJson(u) {
  return { id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar, role: u.role };
}

function getPreferences(db, userId) {
  return db
    .prepare(
      `SELECT p.tag_id AS tagId, t.name AS tagName, t.type AS tagType, p.type
         FROM user_preferences p JOIN tags t ON t.id = p.tag_id
        WHERE p.user_id = ? ORDER BY t.type, t.id`
    )
    .all(userId);
}

function createSession(db, userId) {
  const token = newToken();
  db.prepare(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?,?, datetime('now','localtime','+7 days'))"
  ).run(userId, sha256(token));
  return token;
}

function attachTags(db, dishes) {
  if (!dishes.length) return dishes;
  const all = db
    .prepare('SELECT dt.dish_id, t.id, t.name, t.type FROM dish_tags dt JOIN tags t ON t.id = dt.tag_id')
    .all();
  const map = new Map();
  for (const t of all) {
    if (!map.has(t.dish_id)) map.set(t.dish_id, []);
    map.get(t.dish_id).push({ id: t.id, name: t.name, type: t.type });
  }
  for (const d of dishes) d.tags = map.get(d.id) || [];
  return dishes;
}

function ensureUnlockBadge(db, dish) {
  const exists = db.prepare("SELECT id FROM badge_rules WHERE type='unlock' AND dish_id=?").get(dish.id);
  if (!exists) {
    db.prepare(
      "INSERT INTO badge_rules (type, dish_id, required_count, name, description) VALUES ('unlock', ?, 1, ?, ?)"
    ).run(dish.id, `${dish.name}首尝勋章`, `首次确认吃过「${dish.name}」解锁`);
  }
}

function insertMealItems(db, mealId, items) {
  const ins = db.prepare(
    `INSERT INTO meal_items (meal_id, dish_id, dish_name, quantity, unit_price, unit_calories, source)
     VALUES (?,?,?,?,?,?,?)`
  );
  for (const raw of items) {
    let dishId = raw.dishId != null && raw.dishId !== '' ? Number(raw.dishId) : null;
    if (dishId != null && !Number.isFinite(dishId)) dishId = null;
    let name = raw.dishName != null ? String(raw.dishName) : null;
    let price = raw.unitPrice != null && raw.unitPrice !== '' ? Number(raw.unitPrice) : null;
    let cal = raw.unitCalories != null && raw.unitCalories !== '' ? Number(raw.unitCalories) : null;
    const source = ['photo', 'ocr', 'manual'].includes(raw.source) ? raw.source : 'manual';
    if (dishId != null) {
      const d = db.prepare('SELECT * FROM dishes WHERE id=?').get(dishId);
      if (d) {
        if (name == null) name = d.name;
        if (price == null) price = d.price;
        if (cal == null) cal = d.calories;
      } else {
        dishId = null;
      }
    }
    ins.run(
      mealId,
      dishId,
      name || '未知菜品',
      Math.max(1, Number(raw.quantity) || 1),
      Number(price) || 0,
      cal == null ? null : Number(cal),
      source
    );
  }
}

function mealDetail(db, mealId, userId) {
  const meal = db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').get(mealId, userId);
  if (!meal) return null;
  const items = db
    .prepare(
      `SELECT mi.*, d.image AS dish_image
         FROM meal_items mi LEFT JOIN dishes d ON d.id = mi.dish_id
        WHERE mi.meal_id = ? ORDER BY mi.id`
    )
    .all(mealId);
  const uploads = db
    .prepare('SELECT id, type, file_path, ocr_status FROM meal_uploads WHERE meal_id=? ORDER BY id')
    .all(mealId);
  const evaluation = db.prepare('SELECT * FROM meal_evaluations WHERE meal_id=?').get(mealId);
  if (evaluation) {
    try {
      evaluation.basis = JSON.parse(evaluation.basis);
    } catch {
      /* keep raw */
    }
  }
  return { ...meal, items, uploads, evaluation: evaluation || null };
}

function guessExt(filename, buf) {
  if (buf.length > 3 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return '.png';
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.length > 11 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP')
    return '.webp';
  const ext = filename ? path.extname(String(filename)).toLowerCase() : '';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  return '.png';
}

function mockRecognize(db, type) {
  const pool = db
    .prepare("SELECT id, name, price, calories FROM dishes WHERE status='on_sale' AND calories IS NOT NULL")
    .all();
  if (!pool.length) return [];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const count = type === 'bill' ? 3 : 2;
  return shuffled.slice(0, count).map((d) => ({
    dishId: d.id,
    dishName: d.name,
    quantity: 1,
    unitPrice: d.price,
    unitCalories: d.calories,
    source: type === 'bill' ? 'ocr' : 'photo',
  }));
}

// ===================== 认证 =====================

async function register({ db, body, res }) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const nickname = body.nickname ? String(body.nickname).trim() : username;
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return fail(res, '用户名需为 3-20 位字母/数字/下划线');
  if (password.length < 6) return fail(res, '密码至少 6 位');
  if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) return fail(res, '用户名已被注册');
  const r = db
    .prepare('INSERT INTO users (username, password_hash, nickname) VALUES (?,?,?)')
    .run(username, makePassword(password), nickname);
  const userId = Number(r.lastInsertRowid);
  const token = createSession(db, userId);
  const user = db.prepare('SELECT id, username, nickname, avatar, role FROM users WHERE id=?').get(userId);
  return ok(res, { token, user: userJson(user) });
}

async function login({ db, body, res }) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u || !checkPassword(password, u.password_hash)) return fail(res, '用户名或密码错误');
  if (u.status !== 1) return fail(res, '账号已被禁用', 403);
  const token = createSession(db, u.id);
  return ok(res, { token, user: userJson(u) });
}

async function logout({ db, token, res }) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token));
  return ok(res, {});
}

async function me({ db, user, res }) {
  return ok(res, { user: userJson(user), preferences: getPreferences(db, user.id) });
}

// ===================== 用户 / 偏好 =====================

async function getProfile({ db, user, res }) {
  const stats = {
    mealCount: db.prepare("SELECT COUNT(*) c FROM meals WHERE user_id=? AND status='confirmed'").get(user.id).c,
    planCount: db.prepare('SELECT COUNT(*) c FROM meal_plans WHERE user_id=?').get(user.id).c,
    unlocked: db.prepare('SELECT COUNT(*) c FROM user_dish_progress WHERE user_id=?').get(user.id).c,
    badgeCount: db.prepare('SELECT COUNT(*) c FROM user_badges WHERE user_id=?').get(user.id).c,
  };
  return ok(res, { user: userJson(user), preferences: getPreferences(db, user.id), stats });
}

async function updateProfile({ db, user, body, res }) {
  const sets = [];
  const args = [];
  if (body.nickname !== undefined) {
    sets.push('nickname=?');
    args.push(String(body.nickname).trim());
  }
  if (body.avatar !== undefined) {
    sets.push('avatar=?');
    args.push(body.avatar);
  }
  if (sets.length) {
    sets.push("updated_at=datetime('now','localtime')");
    args.push(user.id);
    db.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...args);
  }
  const u = db.prepare('SELECT id, username, nickname, avatar, role FROM users WHERE id=?').get(user.id);
  return ok(res, { user: userJson(u) });
}

async function changePassword({ db, user, body, token, res }) {
  const oldP = String(body.oldPassword || '');
  const newP = String(body.newPassword || '');
  if (newP.length < 6) return fail(res, '新密码至少 6 位');
  const row = db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
  if (!checkPassword(oldP, row.password_hash)) return fail(res, '原密码不正确');
  db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now','localtime') WHERE id=?").run(
    makePassword(newP),
    user.id
  );
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id, sha256(token || ''));
  return ok(res, {});
}

async function getPreferencesHandler({ db, user, res }) {
  const tags = db.prepare('SELECT id, name, type FROM tags ORDER BY type, id').all();
  const mine = new Map(getPreferences(db, user.id).map((p) => [p.tagId, p.type]));
  return ok(res, { tags: tags.map((t) => ({ ...t, preference: mine.get(t.id) || null })) });
}

async function updatePreferences({ db, user, body, res }) {
  const list = Array.isArray(body.preferences) ? body.preferences : [];
  const valid = new Set(['like', 'dislike', 'avoid', 'allergy']);
  db.prepare('DELETE FROM user_preferences WHERE user_id=?').run(user.id);
  const ins = db.prepare('INSERT OR REPLACE INTO user_preferences (user_id, tag_id, type) VALUES (?,?,?)');
  for (const p of list) {
    const tagId = Number(p.tagId);
    if (!valid.has(p.type)) continue;
    if (!db.prepare('SELECT id FROM tags WHERE id=?').get(tagId)) continue;
    ins.run(user.id, tagId, p.type);
  }
  return ok(res, { preferences: getPreferences(db, user.id) });
}

// ===================== 菜单 =====================

async function listCategories({ db, res }) {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.sort_order,
              (SELECT COUNT(*) FROM dishes d WHERE d.category_id=c.id AND d.status!='off_sale') AS dish_count
         FROM dish_categories c WHERE c.status=1 ORDER BY c.sort_order, c.id`
    )
    .all();
  return ok(res, { categories: rows });
}

async function listTags({ db, res }) {
  const tags = db.prepare('SELECT id, name, type, color FROM tags ORDER BY type, id').all();
  return ok(res, { tags });
}

async function listDishes({ db, query, res }) {
  const conds = [];
  const args = [];
  if (query.categoryId) {
    conds.push('d.category_id = ?');
    args.push(Number(query.categoryId));
  }
  if (query.status) {
    const statuses = String(query.status)
      .split(',')
      .filter((s) => ['pending', 'on_sale', 'off_sale'].includes(s));
    if (statuses.length) {
      conds.push(`d.status IN (${statuses.map(() => '?').join(',')})`);
      args.push(...statuses);
    }
  }
  if (query.search) {
    conds.push('d.name LIKE ?');
    args.push(`%${String(query.search).trim()}%`);
  }
  if (query.tagId) {
    conds.push('d.id IN (SELECT dish_id FROM dish_tags WHERE tag_id = ?)');
    args.push(Number(query.tagId));
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const dishes = db
    .prepare(
      `SELECT d.*, c.name AS category_name
         FROM dishes d LEFT JOIN dish_categories c ON c.id = d.category_id
        ${where}
        ORDER BY (d.status = 'off_sale'), d.id`
    )
    .all(...args);
  attachTags(db, dishes);
  return ok(res, { dishes });
}

async function getDish({ db, params, res }) {
  const dish = db
    .prepare(
      'SELECT d.*, c.name AS category_name FROM dishes d LEFT JOIN dish_categories c ON c.id=d.category_id WHERE d.id=?'
    )
    .get(Number(params[0]));
  if (!dish) return fail(res, '菜品不存在', 404);
  attachTags(db, [dish]);
  return ok(res, { dish });
}

// ===================== 餐前计划 =====================

async function generatePlanHandler({ db, user, body, res }) {
  const result = generatePlan(db, user.id, { budget: body.budget, calorieLimit: body.calorieLimit });
  if (result.error) return fail(res, result.error, 400);
  return ok(res, result);
}

async function listPlans({ db, user, res }) {
  const plans = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM meal_plan_items WHERE meal_plan_id=p.id) AS item_count
         FROM meal_plans p WHERE p.user_id=? ORDER BY p.id DESC`
    )
    .all(user.id);
  return ok(res, { plans });
}

async function getPlan({ db, user, params, res }) {
  const plan = db.prepare('SELECT * FROM meal_plans WHERE id=? AND user_id=?').get(Number(params[0]), user.id);
  if (!plan) return fail(res, '计划不存在', 404);
  const items = db
    .prepare(
      `SELECT i.*, d.image AS dish_image
         FROM meal_plan_items i LEFT JOIN dishes d ON d.id = i.dish_id
        WHERE i.meal_plan_id=? ORDER BY i.id`
    )
    .all(plan.id);
  return ok(res, { plan: { ...plan, items } });
}

// ===================== 餐后记录 =====================

async function createMeal({ db, user, body, res }) {
  const items = Array.isArray(body.items) ? body.items : [];
  const planId = body.planId != null && body.planId !== '' ? Number(body.planId) : null;
  if (planId) {
    const p = db.prepare('SELECT id FROM meal_plans WHERE id=? AND user_id=?').get(planId, user.id);
    if (!p) return fail(res, '关联的计划不存在', 404);
  }
  const eatenAt = body.eatenAt ? String(body.eatenAt) : null;
  const actualPaid =
    body.actualPaid != null && body.actualPaid !== '' ? Number(body.actualPaid) : null;
  const rating = body.rating != null && body.rating !== '' ? Number(body.rating) : null;
  const comment = body.comment != null ? String(body.comment) : null;

  const r = db
    .prepare(
      `INSERT INTO meals (user_id, plan_id, eaten_at, actual_paid, rating, comment, status)
       VALUES (?,?, COALESCE(?, datetime('now','localtime')), ?,?,?, 'draft')`
    )
    .run(user.id, planId, eatenAt, actualPaid, rating, comment);
  const mealId = Number(r.lastInsertRowid);

  insertMealItems(db, mealId, items);

  if (Array.isArray(body.uploadIds)) {
    for (const uid of body.uploadIds) {
      db.prepare('UPDATE meal_uploads SET meal_id=? WHERE id=? AND user_id=?').run(mealId, Number(uid), user.id);
    }
  }

  return ok(res, mealDetail(db, mealId, user.id));
}

async function listMeals({ db, user, res }) {
  const meals = db
    .prepare(
      `SELECT m.*, e.tier, e.score,
              (SELECT COUNT(*) FROM meal_items WHERE meal_id = m.id) AS item_count
         FROM meals m LEFT JOIN meal_evaluations e ON e.meal_id = m.id
        WHERE m.user_id = ? ORDER BY m.eaten_at DESC, m.id DESC`
    )
    .all(user.id);
  return ok(res, { meals });
}

async function getMeal({ db, user, params, res }) {
  const detail = mealDetail(db, Number(params[0]), user.id);
  if (!detail) return fail(res, '记录不存在', 404);
  return ok(res, detail);
}

async function updateMeal({ db, user, params, body, res }) {
  const mealId = Number(params[0]);
  const meal = db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').get(mealId, user.id);
  if (!meal) return fail(res, '记录不存在', 404);
  if (meal.status !== 'draft') return fail(res, '只有草稿可以修改', 409);

  const eatenAt = body.eatenAt !== undefined ? body.eatenAt || null : meal.eaten_at;
  const actualPaid =
    body.actualPaid !== undefined
      ? body.actualPaid === '' || body.actualPaid == null
        ? null
        : Number(body.actualPaid)
      : meal.actual_paid;
  const rating =
    body.rating !== undefined
      ? body.rating === '' || body.rating == null
        ? null
        : Number(body.rating)
      : meal.rating;
  const comment = body.comment !== undefined ? body.comment : meal.comment;

  db.prepare(
    `UPDATE meals SET eaten_at=?, actual_paid=?, rating=?, comment=?, updated_at=datetime('now','localtime')
      WHERE id=?`
  ).run(eatenAt, actualPaid, rating, comment, mealId);

  if (Array.isArray(body.items)) {
    db.prepare('DELETE FROM meal_items WHERE meal_id=?').run(mealId);
    insertMealItems(db, mealId, body.items);
  }

  if (Array.isArray(body.uploadIds)) {
    for (const uid of body.uploadIds) {
      db.prepare('UPDATE meal_uploads SET meal_id=? WHERE id=? AND user_id=?').run(mealId, Number(uid), user.id);
    }
  }

  return ok(res, mealDetail(db, mealId, user.id));
}

async function confirmMealHandler({ db, user, params, res }) {
  const mealId = Number(params[0]);
  const result = confirmMeal(db, mealId, user.id);
  if (result.error) return fail(res, result.error, result.status || 400);
  const ids = result.newBadgeIds || [];
  const badges = ids.length
    ? db.prepare(`SELECT * FROM badge_rules WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : [];
  return ok(res, { ...result, badges });
}

async function voidMealHandler({ db, user, params, res }) {
  const mealId = Number(params[0]);
  const meal = db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').get(mealId, user.id);
  if (!meal) return fail(res, '记录不存在', 404);
  if (meal.status === 'void') return fail(res, '该记录已作废', 409);
  db.prepare("UPDATE meals SET status='void', updated_at=datetime('now','localtime') WHERE id=?").run(mealId);
  recomputeProgress(db, user.id);
  revokeUnearnedBadges(db, user.id);
  return ok(res, { mealId, status: 'void' });
}

// ===================== 上传 / 识别 =====================

async function uploadImage({ db, user, body, res }) {
  const type = body.type === 'bill' ? 'bill' : 'dish';
  let data = String(body.dataBase64 || '');
  if (!data) return fail(res, '缺少图片数据');
  const m = data.match(/^data:[^;]+;base64,(.*)$/s);
  if (m) data = m[1];
  let buf;
  try {
    buf = Buffer.from(data, 'base64');
  } catch {
    return fail(res, '图片 base64 解析失败');
  }
  if (!buf.length) return fail(res, '图片数据为空');
  if (buf.length > 15 * 1024 * 1024) return fail(res, '图片过大（上限 15MB）');

  mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = guessExt(body.filename, buf);
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  writeFileSync(path.join(UPLOAD_DIR, name), buf);

  const r = db
    .prepare('INSERT INTO meal_uploads (user_id, type, file_path) VALUES (?,?,?)')
    .run(user.id, type, name);
  return ok(res, { id: Number(r.lastInsertRowid), path: `/uploads/${name}`, type });
}

async function ocrImage({ db, user, params, res }) {
  const id = Number(params[0]);
  const up = db.prepare('SELECT * FROM meal_uploads WHERE id=? AND user_id=?').get(id, user.id);
  if (!up) return fail(res, '上传记录不存在', 404);
  const drafts = mockRecognize(db, up.type);
  db.prepare("UPDATE meal_uploads SET ocr_status='done', ocr_result=? WHERE id=?").run(
    JSON.stringify(drafts),
    id
  );
  return ok(res, { uploadId: id, type: up.type, items: drafts });
}

// ===================== 图鉴 / 勋章 =====================

async function encyclopedia({ db, user, res }) {
  const dishes = db
    .prepare(
      `SELECT d.id, d.name, d.image, d.price, d.calories, d.status, d.category_id,
              p.eat_count, p.portion_count, p.first_eaten_at
         FROM dishes d
         LEFT JOIN user_dish_progress p ON p.dish_id = d.id AND p.user_id = ?
        WHERE d.status != 'off_sale'
        ORDER BY d.category_id, d.id`
    )
    .all(user.id);
  const total = db.prepare("SELECT COUNT(*) c FROM dishes WHERE status='on_sale'").get().c;
  const unlocked = db.prepare('SELECT COUNT(*) c FROM user_dish_progress WHERE user_id=?').get(user.id).c;
  return ok(res, {
    dishes: dishes.map((d) => ({ ...d, unlocked: d.eat_count > 0 })),
    stats: { total, unlocked },
  });
}

async function listBadges({ db, user, res }) {
  const rules = db.prepare('SELECT * FROM badge_rules ORDER BY type, id').all();
  const owned = new Set(
    db.prepare('SELECT badge_rule_id FROM user_badges WHERE user_id=?').all(user.id).map((r) => r.badge_rule_id)
  );
  const progress = new Map(
    db.prepare('SELECT dish_id, eat_count FROM user_dish_progress WHERE user_id=?').all(user.id).map((r) => [r.dish_id, r.eat_count])
  );
  const badges = rules.map((r) => {
    let count = 0;
    if (r.dish_id != null) count = progress.get(r.dish_id) || 0;
    else if (r.tag_id != null) {
      const ids = db.prepare('SELECT dish_id FROM dish_tags WHERE tag_id=?').all(r.tag_id).map((x) => x.dish_id);
      for (const id of ids) count += progress.get(id) || 0;
    }
    return { ...r, owned: owned.has(r.id), current: count };
  });
  return ok(res, { badges, ownedCount: owned.size, total: rules.length });
}

// ===================== 管理员 =====================

async function adminStats({ db, res }) {
  return ok(res, {
    dishes: db.prepare('SELECT COUNT(*) c FROM dishes').get().c,
    categories: db.prepare('SELECT COUNT(*) c FROM dish_categories').get().c,
    tags: db.prepare('SELECT COUNT(*) c FROM tags').get().c,
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    meals: db.prepare("SELECT COUNT(*) c FROM meals WHERE status='confirmed'").get().c,
  });
}

async function adminCreateDish({ db, body, res }) {
  const name = String(body.name || '').trim();
  if (!name) return fail(res, '菜名不能为空');
  const r = db
    .prepare(
      `INSERT INTO dishes (category_id, name, image, price, calories, description, status, expected_date)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      body.categoryId != null ? Number(body.categoryId) : null,
      name,
      body.image || null,
      Number(body.price) || 0,
      body.calories != null && body.calories !== '' ? Number(body.calories) : null,
      body.description || null,
      ['pending', 'on_sale', 'off_sale'].includes(body.status) ? body.status : 'on_sale',
      body.expectedDate || null
    );
  const id = Number(r.lastInsertRowid);
  if (Array.isArray(body.tagIds)) {
    for (const tid of body.tagIds) {
      db.prepare('INSERT OR IGNORE INTO dish_tags (dish_id, tag_id) VALUES (?,?)').run(id, Number(tid));
    }
  }
  const dish = db.prepare('SELECT * FROM dishes WHERE id=?').get(id);
  ensureUnlockBadge(db, dish);
  return ok(res, { dish: attachTags(db, [dish])[0] });
}

async function adminUpdateDish({ db, params, body, res }) {
  const id = Number(params[0]);
  const dish = db.prepare('SELECT * FROM dishes WHERE id=?').get(id);
  if (!dish) return fail(res, '菜品不存在', 404);
  db.prepare(
    `UPDATE dishes SET category_id=?, name=?, image=?, price=?, calories=?, description=?, status=?,
       expected_date=?, updated_at=datetime('now','localtime') WHERE id=?`
  ).run(
    body.categoryId !== undefined ? (body.categoryId == null || body.categoryId === '' ? null : Number(body.categoryId)) : dish.category_id,
    body.name !== undefined ? String(body.name) : dish.name,
    body.image !== undefined ? body.image : dish.image,
    body.price !== undefined ? Number(body.price) : dish.price,
    body.calories !== undefined
      ? body.calories === '' || body.calories == null
        ? null
        : Number(body.calories)
      : dish.calories,
    body.description !== undefined ? body.description : dish.description,
    body.status !== undefined ? body.status : dish.status,
    body.expectedDate !== undefined ? body.expectedDate : dish.expected_date,
    id
  );
  if (Array.isArray(body.tagIds)) {
    db.prepare('DELETE FROM dish_tags WHERE dish_id=?').run(id);
    for (const tid of body.tagIds) {
      db.prepare('INSERT OR IGNORE INTO dish_tags (dish_id, tag_id) VALUES (?,?)').run(id, Number(tid));
    }
  }
  const updated = db.prepare('SELECT * FROM dishes WHERE id=?').get(id);
  return ok(res, { dish: attachTags(db, [updated])[0] });
}

async function adminDeleteDish({ db, params, res }) {
  db.prepare('DELETE FROM dishes WHERE id=?').run(Number(params[0]));
  return ok(res, {});
}

async function adminCreateCategory({ db, body, res }) {
  const name = String(body.name || '').trim();
  if (!name) return fail(res, '分类名不能为空');
  const r = db
    .prepare('INSERT OR IGNORE INTO dish_categories (name, sort_order) VALUES (?,?)')
    .run(name, Number(body.sortOrder) || 0);
  return ok(res, { id: Number(r.lastInsertRowid) });
}

async function adminUpdateCategory({ db, params, body, res }) {
  const id = Number(params[0]);
  const c = db.prepare('SELECT * FROM dish_categories WHERE id=?').get(id);
  if (!c) return fail(res, '分类不存在', 404);
  db.prepare('UPDATE dish_categories SET name=?, sort_order=?, status=? WHERE id=?').run(
    body.name !== undefined ? String(body.name) : c.name,
    body.sortOrder !== undefined ? Number(body.sortOrder) : c.sort_order,
    body.status !== undefined ? (body.status ? 1 : 0) : c.status,
    id
  );
  return ok(res, {});
}

async function adminDeleteCategory({ db, params, res }) {
  db.prepare('DELETE FROM dish_categories WHERE id=?').run(Number(params[0]));
  return ok(res, {});
}

async function adminCreateTag({ db, body, res }) {
  const name = String(body.name || '').trim();
  if (!name) return fail(res, '标签名不能为空');
  const r = db
    .prepare('INSERT OR IGNORE INTO tags (name, type, color) VALUES (?,?,?)')
    .run(name, body.type === 'flavor' ? 'flavor' : 'ingredient', body.color || null);
  return ok(res, { id: Number(r.lastInsertRowid) });
}

async function adminUpdateTag({ db, params, body, res }) {
  const id = Number(params[0]);
  const t = db.prepare('SELECT * FROM tags WHERE id=?').get(id);
  if (!t) return fail(res, '标签不存在', 404);
  db.prepare('UPDATE tags SET name=?, type=?, color=? WHERE id=?').run(
    body.name !== undefined ? String(body.name) : t.name,
    body.type !== undefined ? body.type : t.type,
    body.color !== undefined ? body.color : t.color,
    id
  );
  return ok(res, {});
}

async function adminDeleteTag({ db, params, res }) {
  db.prepare('DELETE FROM tags WHERE id=?').run(Number(params[0]));
  return ok(res, {});
}

async function adminCreateBadgeRule({ db, body, res }) {
  const name = String(body.name || '').trim();
  if (!name) return fail(res, '勋章名称不能为空');
  const r = db
    .prepare(
      `INSERT INTO badge_rules (type, dish_id, tag_id, required_count, name, image, description)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(
      ['unlock', 'milestone'].includes(body.type) ? body.type : 'milestone',
      body.dishId != null ? Number(body.dishId) : null,
      body.tagId != null ? Number(body.tagId) : null,
      Number(body.requiredCount) || 1,
      name,
      body.image || null,
      body.description || null
    );
  return ok(res, { id: Number(r.lastInsertRowid) });
}

async function adminUpdateBadgeRule({ db, params, body, res }) {
  const id = Number(params[0]);
  const r = db.prepare('SELECT * FROM badge_rules WHERE id=?').get(id);
  if (!r) return fail(res, '勋章规则不存在', 404);
  db.prepare(
    `UPDATE badge_rules SET type=?, dish_id=?, tag_id=?, required_count=?, name=?, image=?, description=? WHERE id=?`
  ).run(
    body.type !== undefined ? body.type : r.type,
    body.dishId !== undefined ? (body.dishId == null ? null : Number(body.dishId)) : r.dish_id,
    body.tagId !== undefined ? (body.tagId == null ? null : Number(body.tagId)) : r.tag_id,
    body.requiredCount !== undefined ? Number(body.requiredCount) : r.required_count,
    body.name !== undefined ? String(body.name) : r.name,
    body.image !== undefined ? body.image : r.image,
    body.description !== undefined ? body.description : r.description,
    id
  );
  return ok(res, {});
}

async function adminDeleteBadgeRule({ db, params, res }) {
  db.prepare('DELETE FROM badge_rules WHERE id=?').run(Number(params[0]));
  return ok(res, {});
}

// ===================== 路由表 =====================

export const routes = [
  // 认证
  { method: 'POST', pattern: /^\/api\/auth\/register$/, handler: register },
  { method: 'POST', pattern: /^\/api\/auth\/login$/, handler: login },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, auth: 'user', handler: logout },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, auth: 'user', handler: me },
  // 用户 / 偏好
  { method: 'GET', pattern: /^\/api\/user\/profile$/, auth: 'user', handler: getProfile },
  { method: 'PUT', pattern: /^\/api\/user\/profile$/, auth: 'user', handler: updateProfile },
  { method: 'PUT', pattern: /^\/api\/user\/password$/, auth: 'user', handler: changePassword },
  { method: 'GET', pattern: /^\/api\/user\/preferences$/, auth: 'user', handler: getPreferencesHandler },
  { method: 'PUT', pattern: /^\/api\/user\/preferences$/, auth: 'user', handler: updatePreferences },
  // 菜单
  { method: 'GET', pattern: /^\/api\/categories$/, handler: listCategories },
  { method: 'GET', pattern: /^\/api\/tags$/, handler: listTags },
  { method: 'GET', pattern: /^\/api\/dishes$/, handler: listDishes },
  { method: 'GET', pattern: /^\/api\/dishes\/(\d+)$/, handler: getDish },
  // 餐前计划
  { method: 'POST', pattern: /^\/api\/plans\/generate$/, auth: 'user', handler: generatePlanHandler },
  { method: 'GET', pattern: /^\/api\/plans$/, auth: 'user', handler: listPlans },
  { method: 'GET', pattern: /^\/api\/plans\/(\d+)$/, auth: 'user', handler: getPlan },
  // 餐后记录
  { method: 'POST', pattern: /^\/api\/meals$/, auth: 'user', handler: createMeal },
  { method: 'GET', pattern: /^\/api\/meals$/, auth: 'user', handler: listMeals },
  { method: 'GET', pattern: /^\/api\/meals\/(\d+)$/, auth: 'user', handler: getMeal },
  { method: 'PUT', pattern: /^\/api\/meals\/(\d+)$/, auth: 'user', handler: updateMeal },
  { method: 'POST', pattern: /^\/api\/meals\/(\d+)\/confirm$/, auth: 'user', handler: confirmMealHandler },
  { method: 'POST', pattern: /^\/api\/meals\/(\d+)\/void$/, auth: 'user', handler: voidMealHandler },
  // 上传 / 识别
  { method: 'POST', pattern: /^\/api\/uploads$/, auth: 'user', handler: uploadImage },
  { method: 'POST', pattern: /^\/api\/uploads\/(\d+)\/ocr$/, auth: 'user', handler: ocrImage },
  // 图鉴 / 勋章
  { method: 'GET', pattern: /^\/api\/encyclopedia$/, auth: 'user', handler: encyclopedia },
  { method: 'GET', pattern: /^\/api\/badges$/, auth: 'user', handler: listBadges },
  // 管理员
  { method: 'GET', pattern: /^\/api\/admin\/stats$/, auth: 'admin', handler: adminStats },
  { method: 'POST', pattern: /^\/api\/admin\/dishes$/, auth: 'admin', handler: adminCreateDish },
  { method: 'PUT', pattern: /^\/api\/admin\/dishes\/(\d+)$/, auth: 'admin', handler: adminUpdateDish },
  { method: 'DELETE', pattern: /^\/api\/admin\/dishes\/(\d+)$/, auth: 'admin', handler: adminDeleteDish },
  { method: 'POST', pattern: /^\/api\/admin\/categories$/, auth: 'admin', handler: adminCreateCategory },
  { method: 'PUT', pattern: /^\/api\/admin\/categories\/(\d+)$/, auth: 'admin', handler: adminUpdateCategory },
  { method: 'DELETE', pattern: /^\/api\/admin\/categories\/(\d+)$/, auth: 'admin', handler: adminDeleteCategory },
  { method: 'POST', pattern: /^\/api\/admin\/tags$/, auth: 'admin', handler: adminCreateTag },
  { method: 'PUT', pattern: /^\/api\/admin\/tags\/(\d+)$/, auth: 'admin', handler: adminUpdateTag },
  { method: 'DELETE', pattern: /^\/api\/admin\/tags\/(\d+)$/, auth: 'admin', handler: adminDeleteTag },
  { method: 'POST', pattern: /^\/api\/admin\/badge-rules$/, auth: 'admin', handler: adminCreateBadgeRule },
  { method: 'PUT', pattern: /^\/api\/admin\/badge-rules\/(\d+)$/, auth: 'admin', handler: adminUpdateBadgeRule },
  { method: 'DELETE', pattern: /^\/api\/admin\/badge-rules\/(\d+)$/, auth: 'admin', handler: adminDeleteBadgeRule },
];

export function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(pathname);
    if (m) return { handler: r.handler, params: m.slice(1), auth: r.auth };
  }
  return null;
}
