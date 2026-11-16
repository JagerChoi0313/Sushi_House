import { round, nowStr } from './util.js';

/**
 * 五档评级规则（v2）。
 *
 * v1 → v2 只改了 label，key 一个没动 —— key 是存在 `meal_evaluations.tier` 里的，
 * 改 key 会让历史记录变成孤儿，所以「换掉难听的词」只能在 label 层做。
 * v1 的标签是「夯 / 顶级 / 人上人 / NPC / 拉完了」：后两个是网络贬义词，
 * 用来形容一个人自己吃的一顿饭，而且这个评级无处可关。审计 B4 记录了这件事。
 * v2 换成只描述这一餐的中性词，不带对人的评价。
 */
export const TIER_RULES = {
  version: 'v2',
  tiers: [
    { key: 'hang', min: 90, label: '很棒' },
    { key: 'top', min: 75, label: '不错' },
    { key: 'elite', min: 60, label: '一般' },
    { key: 'npc', min: 40, label: '偏多' },
    { key: 'lame', min: 0, label: '偏少' },
  ],
};

export function tierOf(score) {
  for (const t of TIER_RULES.tiers) if (score >= t.min) return t;
  return TIER_RULES.tiers[TIER_RULES.tiers.length - 1];
}

/**
 * 对一条已确认的用餐记录生成测评（写入 meal_evaluations，幂等 upsert）。
 */
export function evaluateMeal(db, mealId) {
  const meal = db.prepare('SELECT * FROM meals WHERE id=?').get(mealId);
  if (!meal) return null;

  const items = db.prepare('SELECT * FROM meal_items WHERE meal_id=?').all(mealId);
  const plan = meal.plan_id
    ? db.prepare('SELECT * FROM meal_plans WHERE id=?').get(meal.plan_id)
    : null;

  let estPrice = 0;
  let estCal = 0;
  for (const it of items) {
    estPrice += (it.unit_price || 0) * (it.quantity || 0);
    if (it.unit_calories != null) estCal += it.unit_calories * (it.quantity || 0);
  }

  const prefs = new Map(
    db
      .prepare('SELECT tag_id, type FROM user_preferences WHERE user_id=?')
      .all(meal.user_id)
      .map((r) => [r.tag_id, r.type])
  );

  // 口味命中按**菜品**计，不按标签出现次数计（BUG-10）。
  // 一道菜挂了两个「喜欢」的标签，仍然只算它这一道合口味；
  // 同时挂喜欢和讨厌时忌口优先（算不合口味）。
  let likeHit = 0;
  let dislikeHit = 0;
  let prefTotal = 0; // 有偏好标签可判的菜品数（prefRatio 的分母）
  let matchedItems = 0; // 匹配到菜单的菜品数
  for (const it of items) {
    if (it.dish_id == null) continue;
    matchedItems++;
    const tagIds = db
      .prepare('SELECT tag_id FROM dish_tags WHERE dish_id=?')
      .all(it.dish_id)
      .map((r) => r.tag_id);
    let hasLike = false;
    let hasDislike = false;
    for (const t of tagIds) {
      const p = prefs.get(t);
      if (p === 'like') hasLike = true;
      else if (p === 'dislike') hasDislike = true;
    }
    if (!hasLike && !hasDislike) continue;
    prefTotal++;
    if (hasDislike) dislikeHit++;
    else likeHit++;
  }
  // 分母 = 「有偏好标签可判的菜品数」。两次修正都记在这里：
  //   · 最初只在 p==='like' 时自增分母 → likeHit 恒等于分母、口味匹配率恒为 1
  //     （占 20 分的项退化成常数）；
  //   · 2026-11-09 上午改成按标签次数计 → 一道菜挂两个喜欢标签就算 2 次；
  //     下午进一步改成按菜品计，跟「口味匹配率」这个名字对齐。
  // 没有任何偏好标签命中时给 0.5，代表「无从判断」的中性值。
  // 审计 A9：这个 0.5 过去会被当成「一半符合」白送 10 分 —— 一个从没设过偏好的人
  // 和一个设了偏好但刚好一半不符的人拿到完全一样的分数。现在把「无数据」和
  // 「一半不符」分开：prefRatio 仍算 0.5 供展示，但计分时只有 prefTotal > 0 才参与。
  const prefRatio = prefTotal > 0 ? likeHit / prefTotal : 0.5;

  let budgetMet = null;
  let budgetDelta = 0;
  if (plan && plan.budget > 0) {
    const paid = meal.actual_paid != null ? meal.actual_paid : estPrice;
    budgetMet = paid <= plan.budget;
    budgetDelta = round(paid - plan.budget, 1);
  }

  let calorieMet = null;
  let calorieRatio = 0;
  if (plan && plan.calorie_limit != null && plan.calorie_limit > 0) {
    calorieMet = estCal <= plan.calorie_limit;
    calorieRatio = estCal / plan.calorie_limit;
  }

  // 评分（审计 A10：把「有没有用推荐」从档位里拿掉）。
  //
  // 旧算法是固定加分制：基础 60，预算达成 +15、热量达成 +15、口味 +20。
  // 问题在于预算与热量两项**只有关联了推荐计划才存在** ——
  // 手记一餐的人上限是 60+20 = 80，走推荐的人上限是 60+15+15+20 = 110（clamp 100）。
  // 同样吃得很好，走推荐就多 20 分空间，够跨两个档位，而用户完全不知道这件事。
  //
  // 新算法按「参与项」归一化：只有真正被评过的项进分母，最后统一折算到 50 分制。
  // 三项齐全时与原算法逐字等价（earned 满分 50 → +50，超支/超标各 −15 也一样），
  // 区别只在缺项时不再天然少分：没有计划的一餐若口味全中，同样能拿满。
  //
  // dislike 的惩罚不参与归一化 —— 踩雷是明确的负反馈，不该因为「缺数据导致分母变小」
  // 而被放大成扣 7.5 分。
  let score = 60;
  let earned = 0;
  let possible = 0;
  if (budgetMet !== null) {
    possible += 15;
    if (budgetMet === true) earned += 15;
    else {
      // budgetDelta = 实付 - 预算，超支时为正。原实现写成 -budgetDelta，负负得正，
      // 结果「超支反而加分」。这里改成超支越多扣分越多，上限 -15（与下面的热量分支同形）。
      earned += Math.max(-15, -15 * Math.min(1, budgetDelta / (plan.budget || 1)));
    }
  }
  if (calorieMet !== null) {
    possible += 15;
    if (calorieMet === true) earned += 15;
    else earned += Math.max(-15, -15 * Math.min(1, calorieRatio - 1));
  }
  if (prefTotal > 0) {
    possible += 20;
    earned += prefRatio * 20;
  }
  if (possible > 0) score += (earned / possible) * 50;
  score += -dislikeHit * 3;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const tier = tierOf(score);
  const basis = {
    plan: plan ? { budget: plan.budget, calorieLimit: plan.calorie_limit } : null,
    budgetMet,
    budgetDelta,
    actualPaid: meal.actual_paid,
    estimatedPrice: round(estPrice, 1),
    calorieMet,
    estimatedCalories: round(estCal, 0),
    calorieLimit: plan?.calorie_limit ?? null,
    prefRatio: round(prefRatio, 2),
    likeHit,
    dislikeHit,
    prefTotal,
    matchedItems,
    prefCountMode: 'per-dish', // 2026-11-09 起：按菜品计；更早写下的记录是按标签次数计
    // 计分口径（审计 A10）：参与归一化的项与它们的原始满分，便于解释「为什么这个分数」
    scored: { earned: round(earned, 1), possible, mode: 'normalized' },
  };

  db.prepare(`INSERT INTO meal_evaluations
      (meal_id, estimated_price, estimated_calories, score, tier, basis, rule_version)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(meal_id) DO UPDATE SET
        estimated_price=excluded.estimated_price,
        estimated_calories=excluded.estimated_calories,
        score=excluded.score,
        tier=excluded.tier,
        basis=excluded.basis,
        rule_version=excluded.rule_version`)
    .run(
      mealId,
      round(estPrice, 1),
      round(estCal, 0),
      score,
      tier.key,
      JSON.stringify(basis),
      TIER_RULES.version
    );

  return {
    score,
    tierKey: tier.key,
    tierLabel: tier.label,
    estimatedPrice: round(estPrice, 1),
    estimatedCalories: round(estCal, 0),
    basis,
  };
}

/**
 * 从「已确认」记录重算某用户的菜品图鉴进度。
 * 规则：草稿 / 作废 / 未匹配到菜单的菜品不计入。
 */
export function recomputeProgress(db, userId) {
  db.prepare('DELETE FROM user_dish_progress WHERE user_id=?').run(userId);
  const rows = db
    .prepare(
      `SELECT mi.dish_id,
              COUNT(DISTINCT m.id) AS eat_count,
              SUM(mi.quantity)      AS portion_count,
              MIN(m.eaten_at)       AS first_eaten_at
         FROM meal_items mi
         JOIN meals m ON m.id = mi.meal_id
        WHERE m.user_id = ? AND m.status = 'confirmed' AND mi.dish_id IS NOT NULL
        GROUP BY mi.dish_id`
    )
    .all(userId);
  const ins = db.prepare(
    `INSERT INTO user_dish_progress
       (user_id, dish_id, eat_count, portion_count, first_eaten_at, updated_at)
     VALUES (?,?,?,?,?,?)`
  );
  for (const r of rows) {
    ins.run(userId, r.dish_id, r.eat_count, r.portion_count, r.first_eaten_at, nowStr());
  }
}

function progressMap(db, userId) {
  return new Map(
    db
      .prepare('SELECT dish_id, eat_count FROM user_dish_progress WHERE user_id=?')
      .all(userId)
      .map((r) => [r.dish_id, r.eat_count])
  );
}

function ruleCurrentCount(db, rule, progress) {
  if (rule.dish_id != null) return progress.get(rule.dish_id) || 0;
  if (rule.tag_id != null) {
    const dishIds = db
      .prepare('SELECT dish_id FROM dish_tags WHERE tag_id=?')
      .all(rule.tag_id)
      .map((r) => r.dish_id);
    let n = 0;
    for (const d of dishIds) n += progress.get(d) || 0;
    return n;
  }
  return 0;
}

export function earnedRuleIds(db, userId) {
  const progress = progressMap(db, userId);
  const rules = db.prepare('SELECT * FROM badge_rules').all();
  const earned = new Set();
  for (const rule of rules) {
    if (rule.required_count > 0 && ruleCurrentCount(db, rule, progress) >= rule.required_count) {
      earned.add(rule.id);
    }
  }
  return earned;
}

/** 发放新达成的勋章，返回新获得的规则 id 列表 */
export function awardBadges(db, userId) {
  const earned = earnedRuleIds(db, userId);
  const owned = new Set(
    db.prepare('SELECT badge_rule_id FROM user_badges WHERE user_id=?').all(userId).map((r) => r.badge_rule_id)
  );
  const ins = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_rule_id, awarded_at) VALUES (?,?,?)');
  const added = [];
  for (const rid of earned) {
    if (!owned.has(rid)) {
      ins.run(userId, rid, nowStr());
      added.push(rid);
    }
  }
  return added;
}

/** 回收已不再满足条件的勋章（如作废记录后） */
export function revokeUnearnedBadges(db, userId) {
  const earned = earnedRuleIds(db, userId);
  const owned = db
    .prepare('SELECT badge_rule_id FROM user_badges WHERE user_id=?')
    .all(userId)
    .map((r) => r.badge_rule_id);
  const del = db.prepare('DELETE FROM user_badges WHERE user_id=? AND badge_rule_id=?');
  const removed = [];
  for (const rid of owned) {
    if (!earned.has(rid)) {
      del.run(userId, rid);
      removed.push(rid);
    }
  }
  return removed;
}

/**
 * 确认餐后记录：置为 confirmed → 生成评级 → 重算图鉴进度 → 发放勋章。
 */
export function confirmMeal(db, mealId, userId) {
  const meal = db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').get(mealId, userId);
  if (!meal) return { error: '记录不存在', status: 404 };
  if (meal.status === 'confirmed') return { error: '该记录已确认', status: 409 };
  if (meal.status === 'void') return { error: '该记录已作废', status: 409 };

  const items = db.prepare('SELECT * FROM meal_items WHERE meal_id=?').all(mealId);
  if (items.length === 0) return { error: '请先添加菜品再确认', status: 400 };

  // 四步写库必须是一个原子操作（审计 A11）：
  //   UPDATE meals → INSERT 评级 → 重建图鉴进度（**先 DELETE 再重建**）→ 发勋章
  // 原来四步裸跑，任何一步抛错都会留下不一致状态。最糟的是第三步：
  // recomputeProgress 一进来就 `DELETE FROM user_dish_progress WHERE user_id=?`，
  // 若删完在重建中途失败，用户**所有菜的解锁进度会被清零**（勋章也跟着掉）。
  // node:sqlite 是同步 API，用显式 BEGIN/COMMIT 包住即可；catch 里 ROLLBACK 再抛。
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE meals SET status='confirmed', updated_at=datetime('now','localtime') WHERE id=?").run(mealId);
    const evaluation = evaluateMeal(db, mealId);
    recomputeProgress(db, userId);
    const newBadgeIds = awardBadges(db, userId);
    db.exec('COMMIT');
    return { evaluation, newBadgeIds };
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* 回滚本身失败就没什么可做的了，把原始错误抛出去更有用 */
    }
    throw e;
  }
}
