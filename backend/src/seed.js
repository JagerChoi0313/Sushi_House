import { getDb } from './db.js';
import { makePassword } from './auth.js';
import { evaluateMeal, recomputeProgress, awardBadges } from './evaluate.js';

const CATEGORIES = ['寿司', '刺身', '天妇罗', '小食', '甜点', '饮品'];

const TAGS = [
  ['三文鱼', 'ingredient'], ['金枪鱼', 'ingredient'], ['虾', 'ingredient'], ['鸡蛋', 'ingredient'],
  ['小麦', 'ingredient'], ['乳制品', 'ingredient'], ['油炸', 'ingredient'], ['生食', 'ingredient'],
  ['黄瓜', 'ingredient'], ['牛油果', 'ingredient'], ['蟹肉', 'ingredient'], ['鳗鱼', 'ingredient'],
  ['海苔', 'ingredient'], ['鲜', 'flavor'], ['甜', 'flavor'], ['咸', 'flavor'], ['酸', 'flavor'], ['苦', 'flavor'],
];

// 名称, 分类, 价格, 每份热量, 状态, 预计上架日期, 描述, 标签
const DISHES = [
  ['三文鱼寿司', '寿司', 12, 45, 'on_sale', null, '招牌三文鱼握寿司', ['三文鱼', '生食', '鲜']],
  ['金枪鱼寿司', '寿司', 15, 48, 'on_sale', null, '厚切金枪鱼握寿司', ['金枪鱼', '生食', '鲜']],
  ['虾寿司', '寿司', 14, 40, 'on_sale', null, '甜虾握寿司', ['虾', '生食', '鲜']],
  ['玉子烧寿司', '寿司', 10, 55, 'on_sale', null, '微甜玉子烧', ['鸡蛋', '甜']],
  ['鳗鱼寿司', '寿司', 18, 70, 'on_sale', null, '蒲烧鳗鱼', ['鳗鱼', '甜', '咸']],
  ['蟹肉棒寿司', '寿司', 9, 38, 'on_sale', null, '蟹肉棒', ['蟹肉', '咸', '海苔']],
  ['黄瓜卷', '寿司', 8, 30, 'on_sale', null, '清爽黄瓜细卷', ['黄瓜', '海苔', '鲜']],
  ['三文鱼刺身', '刺身', 28, 120, 'on_sale', null, '厚切三文鱼刺身', ['三文鱼', '生食', '鲜']],
  ['金枪鱼刺身', '刺身', 32, 110, 'on_sale', null, '赤身金枪鱼刺身', ['金枪鱼', '生食', '鲜']],
  ['甜虾刺身', '刺身', 26, 90, 'on_sale', null, '甜虾刺身', ['虾', '生食', '甜']],
  ['炸虾天妇罗', '天妇罗', 22, 180, 'on_sale', null, '酥脆炸虾天妇罗', ['虾', '油炸', '小麦', '咸']],
  ['炸蔬菜天妇罗', '天妇罗', 18, 150, 'on_sale', null, '时蔬天妇罗', ['油炸', '小麦', '咸', '黄瓜']],
  ['煎饺', '小食', 16, 200, 'on_sale', null, '日式煎饺', ['小麦', '油炸', '咸']],
  ['味噌汤', '小食', 6, 40, 'on_sale', null, '海苔味噌汤', ['咸', '海苔']],
  ['茶碗蒸', '小食', 12, 90, 'on_sale', null, '虾仁茶碗蒸', ['鸡蛋', '虾', '鲜']],
  ['抹茶冰淇淋', '甜点', 15, 160, 'on_sale', null, '宇治抹茶冰淇淋', ['乳制品', '甜', '苦']],
  ['红豆和果子', '甜点', 12, 130, 'on_sale', null, '红豆大福', ['甜', '小麦']],
  ['抹茶', '饮品', 8, 5, 'on_sale', null, '宇治抹茶', ['苦']],
  ['乌龙茶', '饮品', 6, 0, 'on_sale', null, '冰乌龙茶', []],
  ['可乐', '饮品', 7, 140, 'on_sale', null, '冰可乐', ['甜']],
  ['炙烤三文鱼寿司', '寿司', 16, 60, 'pending', '2026-12-15', '新品预热：炙烤三文鱼', ['三文鱼', '鲜']],
  ['旧款花之恋', '寿司', 20, 100, 'off_sale', null, '已下架旧款', ['生食', '乳制品']],
];

const MILESTONES = [
  ['天妇罗达人', '油炸', 15],
  ['三文鱼爱好者', '三文鱼', 10],
  ['金枪鱼猎人', '金枪鱼', 10],
  ['甜品控', '甜', 20],
  ['生食勇者', '生食', 10],
];

/**
 * 写入种子数据（幂等：有菜品则跳过）。
 */
export function seedAll(db = getDb(), { force = false } = {}) {
  const already = db.prepare('SELECT COUNT(*) c FROM dishes').get().c;
  if (already > 0 && !force) return { skipped: true };

  // 分类
  const catId = {};
  CATEGORIES.forEach((name, i) => {
    db.prepare('INSERT OR IGNORE INTO dish_categories (name, sort_order) VALUES (?,?)').run(name, i);
    catId[name] = db.prepare('SELECT id FROM dish_categories WHERE name=?').get(name).id;
  });

  // 标签
  const tagId = {};
  for (const [name, type] of TAGS) {
    db.prepare('INSERT OR IGNORE INTO tags (name, type) VALUES (?,?)').run(name, type);
    tagId[name] = db.prepare('SELECT id FROM tags WHERE name=?').get(name).id;
  }

  // 菜品
  for (const [name, cat, price, cal, status, expected, desc, tags] of DISHES) {
    const r = db
      .prepare(
        `INSERT INTO dishes (category_id, name, price, calories, status, expected_date, description)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(catId[cat], name, price, cal, status, expected, desc);
    const did = Number(r.lastInsertRowid);
    for (const t of tags) {
      db.prepare('INSERT OR IGNORE INTO dish_tags (dish_id, tag_id) VALUES (?,?)').run(did, tagId[t]);
    }
  }

  // 勋章规则：每道菜一个「首尝」解锁勋章
  const dishRows = db.prepare('SELECT id, name FROM dishes').all();
  for (const d of dishRows) {
    db.prepare(
      `INSERT INTO badge_rules (type, dish_id, required_count, name, description)
       VALUES ('unlock', ?, 1, ?, ?)`
    ).run(d.id, `${d.name}首尝勋章`, `首次确认吃过「${d.name}」解锁`);
  }
  // 里程碑勋章
  for (const [name, tagName, count] of MILESTONES) {
    if (!tagId[tagName]) continue;
    db.prepare(
      `INSERT INTO badge_rules (type, tag_id, required_count, name, description)
       VALUES ('milestone', ?, ?, ?, ?)`
    ).run(tagId[tagName], count, name, `累计确认吃过「${tagName}」标签菜品 ${count} 次解锁`);
  }

  // 管理员
  if (!db.prepare('SELECT id FROM users WHERE username=?').get('admin')) {
    db.prepare('INSERT INTO users (username, password_hash, nickname, role) VALUES (?,?,?,?)').run(
      'admin',
      makePassword('admin123'),
      '管理员',
      'admin'
    );
  }

  // 演示用户
  let demo = db.prepare('SELECT id FROM users WHERE username=?').get('demo');
  let demoId;
  if (!demo) {
    const r = db
      .prepare('INSERT INTO users (username, password_hash, nickname, role) VALUES (?,?,?,?)')
      .run('demo', makePassword('demo123'), '小太郎', 'user');
    demoId = Number(r.lastInsertRowid);
  } else {
    demoId = demo.id;
  }

  // 演示用户偏好
  const prefs = [
    ['三文鱼', 'like'],
    ['虾', 'like'],
    ['鲜', 'like'],
    ['咸', 'dislike'],
    ['牛油果', 'avoid'],
    ['乳制品', 'allergy'],
  ];
  for (const [name, type] of prefs) {
    if (!tagId[name]) continue;
    db.prepare('INSERT OR IGNORE INTO user_preferences (user_id, tag_id, type) VALUES (?,?,?)').run(
      demoId,
      tagId[name],
      type
    );
  }

  // 演示用餐记录（已确认）
  const dishIdByName = new Map(db.prepare('SELECT id, name FROM dishes').all().map((d) => [d.name, d.id]));
  const demoMeals = [
    {
      eatenAt: '2026-10-28 12:30:00',
      paid: 55,
      rating: 5,
      comment: '三文鱼很新鲜，性价比不错',
      items: [['三文鱼寿司', 2], ['金枪鱼寿司', 1], ['炸虾天妇罗', 1]],
    },
    {
      eatenAt: '2026-11-02 18:45:00',
      paid: 54,
      rating: 4,
      comment: '刺身厚切，吃得很满足',
      items: [['三文鱼刺身', 1], ['甜虾刺身', 1]],
    },
  ];
  for (const m of demoMeals) {
    const r = db
      .prepare(
        'INSERT INTO meals (user_id, eaten_at, actual_paid, rating, comment, status) VALUES (?,?,?,?,?,?)'
      )
      .run(demoId, m.eatenAt, m.paid, m.rating, m.comment, 'confirmed');
    const mid = Number(r.lastInsertRowid);
    for (const [dname, qty] of m.items) {
      const did = dishIdByName.get(dname);
      const d = db.prepare('SELECT price, calories FROM dishes WHERE id=?').get(did);
      db.prepare(
        `INSERT INTO meal_items
           (meal_id, dish_id, dish_name, quantity, unit_price, unit_calories, source)
         VALUES (?,?,?,?,?,?,?)`
      ).run(mid, did, dname, qty, d.price, d.calories, 'manual');
    }
    evaluateMeal(db, mid);
  }

  recomputeProgress(db, demoId);
  awardBadges(db, demoId);
  return { skipped: false };
}
