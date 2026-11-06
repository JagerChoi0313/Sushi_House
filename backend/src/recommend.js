import { round } from './util.js';

/**
 * 餐前推荐：根据预算 + 可选热量上限 + 用户偏好，生成菜品组合并落库。
 * 返回 { planId, budget, calorieLimit, estimatedPrice, estimatedCalories, remaining, items } 或 { error }。
 */
export function generatePlan(db, userId, { budget, calorieLimit }) {
  const b = Number(budget);
  if (!Number.isFinite(b) || b <= 0) return { error: '请输入大于 0 的预算' };

  let calLimit = calorieLimit == null || calorieLimit === '' ? null : Number(calorieLimit);
  if (calLimit != null && (!Number.isFinite(calLimit) || calLimit <= 0)) calLimit = null;

  const prefRows = db.prepare('SELECT tag_id, type FROM user_preferences WHERE user_id=?').all(userId);
  const prefType = new Map(prefRows.map((r) => [r.tag_id, r.type]));
  const snapshot = prefRows.map((r) => ({ tagId: r.tag_id, type: r.type }));

  const dishes = db.prepare("SELECT * FROM dishes WHERE status='on_sale' ORDER BY id ASC").all();
  const tagRows = db.prepare('SELECT dish_id, tag_id FROM dish_tags').all();
  const tagsByDish = new Map();
  for (const r of tagRows) {
    if (!tagsByDish.has(r.dish_id)) tagsByDish.set(r.dish_id, []);
    tagsByDish.get(r.dish_id).push(r.tag_id);
  }

  // 1. 过滤忌口/过敏；热量上限时只保留已录入热量的菜
  const candidates = [];
  for (const d of dishes) {
    const tags = tagsByDish.get(d.id) || [];
    if (tags.some((t) => prefType.get(t) === 'avoid' || prefType.get(t) === 'allergy')) continue;
    if (calLimit != null) {
      if (d.calories == null || d.calories > calLimit) continue;
    }
    let likeHit = 0;
    let dislikeHit = 0;
    for (const t of tags) {
      const p = prefType.get(t);
      if (p === 'like') likeHit++;
      else if (p === 'dislike') dislikeHit++;
    }
    candidates.push({ dish: d, tags, likeHit, dislikeHit, score: likeHit * 2 - dislikeHit });
  }

  // 2. 按偏好分排序，同分便宜的优先
  candidates.sort((a, b2) => b2.score - a.score || a.dish.price - b2.dish.price);

  const items = [];
  let totalPrice = 0;
  let totalCal = 0;

  // 3. 每种菜先各来 1 份（贪心）
  for (const c of candidates) {
    if (totalPrice + c.dish.price > b) continue;
    if (calLimit != null && totalCal + (c.dish.calories || 0) > calLimit) continue;
    items.push({ dish: c.dish, quantity: 1 });
    totalPrice += c.dish.price;
    totalCal += c.dish.calories || 0;
  }

  if (items.length === 0) {
    const cheapest = candidates
      .filter((c) => c.dish.price <= b && (calLimit == null || (c.dish.calories || 0) <= calLimit))
      .sort((a, b2) => a.dish.price - b2.dish.price)[0];
    if (!cheapest) {
      return {
        error:
          calLimit != null
            ? '当前预算和热量上限下没有可行组合，请调高预算或热量上限'
            : '当前预算过低，没有可选菜品',
      };
    }
    items.push({ dish: cheapest.dish, quantity: 1 });
    totalPrice = cheapest.dish.price;
    totalCal = cheapest.dish.calories || 0;
  } else {
    // 4. 补充份数：在预算和热量内尽量多给，最多补 3 轮
    for (let r = 0; r < 3; r++) {
      let added = false;
      for (const it of items) {
        if (totalPrice >= b * 0.95) break;
        const p = it.dish.price;
        const c = it.dish.calories || 0;
        if (p <= 0) continue;
        if (totalPrice + p > b) continue;
        if (calLimit != null && totalCal + c > calLimit) continue;
        it.quantity += 1;
        totalPrice += p;
        totalCal += c;
        added = true;
      }
      if (!added || totalPrice >= b * 0.95) break;
    }
  }

  if (items.length === 0) return { error: '没有可用组合' };

  // 5. 落库（含快照）
  const r = db.prepare(
    `INSERT INTO meal_plans
       (user_id, budget, calorie_limit, preferences_snapshot, estimated_price, estimated_calories)
     VALUES (?,?,?,?,?,?)`
  ).run(
    userId,
    round(b, 1),
    calLimit == null ? null : round(calLimit, 0),
    JSON.stringify(snapshot),
    round(totalPrice, 1),
    round(totalCal, 0)
  );
  const planId = Number(r.lastInsertRowid);

  const insItem = db.prepare(
    `INSERT INTO meal_plan_items
       (meal_plan_id, dish_id, dish_name, quantity, unit_price, unit_calories)
     VALUES (?,?,?,?,?,?)`
  );
  for (const it of items) {
    insItem.run(planId, it.dish.id, it.dish.name, it.quantity, it.dish.price, it.dish.calories);
  }

  return {
    planId,
    budget: round(b, 1),
    calorieLimit: calLimit == null ? null : round(calLimit, 0),
    estimatedPrice: round(totalPrice, 1),
    estimatedCalories: round(totalCal, 0),
    remaining: round(b - totalPrice, 1),
    items: items.map((it) => ({
      dishId: it.dish.id,
      name: it.dish.name,
      image: it.dish.image,
      quantity: it.quantity,
      unitPrice: it.dish.price,
      unitCalories: it.dish.calories,
    })),
  };
}
