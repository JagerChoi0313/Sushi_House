/**
 * 数据标签的中英映射（地区 / 分类 / 标签 / 过敏原 / 勋章）。
 *
 * 与 i18n.js 的分工：
 *   · i18n.js 管「界面文案」—— 代码里写死的句子，用中文原句当 key；
 *   · 本文件管「数据库枚举值」—— 分类名、地区名、标签名这些来自后端的有限集合。
 *
 * 为什么这些要翻：它们是**导航**（筛选 chip、分类 tab），不是菜单内容。
 * 菜单内容（菜名）不翻 —— 那是店里的实际品名，翻了就对不上菜单。
 */
import { locale } from './i18n.js';

/** 地区：code → 英文 */
const REGION_EN = {
  TW: 'Taiwan',
  JP: 'Japan',
  KR: 'Korea',
  SG: 'Singapore',
  MY: 'Malaysia',
  ID: 'Indonesia',
  HK: 'Hong Kong',
};

/**
 * 分类：中（简/繁都有）→ 英文。
 * 数据库里简体繁体混着存（`握寿司` 与 `握壽司`、`甜点` 与 `甜點`），
 * 所以两种写法都得收，不能只收简体。
 */
const CATEGORY_EN = {
  寿司: 'Sushi',
  刺身: 'Sashimi',
  天妇罗: 'Tempura',
  小食: 'Snacks',
  甜点: 'Dessert',
  饮品: 'Drinks',
  期間限定: 'Limited time',
  握壽司: 'Nigiri',
  握寿司: 'Nigiri',
  軍艦: 'Gunkan',
  军舰: 'Gunkan',
  卷類: 'Rolls',
  卷类: 'Rolls',
  外帶菜單: 'Takeout menu',
  外带菜单: 'Takeout menu',
  麵類: 'Noodles',
  面类: 'Noodles',
  湯類: 'Soups',
  汤类: 'Soups',
  副餐類: 'Sides',
  副餐: 'Sides',
  甜點: 'Dessert',
  飲料: 'Drinks',
  饮料: 'Drinks',
  套餐: 'Sets',
  '鲔鱼/鲜鱼/鲑鱼': 'Tuna / fish / salmon',
  '蝦/貝/魷魚': 'Shrimp / shellfish / squid',
  '虾/贝/鱿鱼': 'Shrimp / shellfish / squid',
  外賣自取: 'Takeaway',
  '军舰/卷类': 'Gunkan / rolls',
  '軍艦・卷物': 'Gunkan / rolls',
  '甜点/饮料': 'Dessert / drinks',
  '甜品・飲料': 'Dessert / drinks',
  '肉类/其他': 'Meat / other',
  嚴選二貫: 'Premium two-piece',
  加料: 'Toppings',
};

/** 标签（tags 表）：中 → 英文。含 ingredient 与 flavor 两类。 */
const TAG_EN = {
  三文鱼: 'Salmon',
  金枪鱼: 'Tuna',
  虾: 'Shrimp',
  鸡蛋: 'Egg',
  小麦: 'Wheat',
  乳制品: 'Dairy',
  油炸: 'Deep-fried',
  生食: 'Raw',
  黄瓜: 'Cucumber',
  牛油果: 'Avocado',
  蟹肉: 'Crab',
  鳗鱼: 'Eel',
  海苔: 'Seaweed',
  鲜: 'Umami',
  甜: 'Sweet',
  咸: 'Salty',
  酸: 'Sour',
  苦: 'Bitter',
};

/** 过敏原：`allergens.js` 归一后的中文名 → 英文（28 品目 + 常见补充）。 */
const ALLERGEN_EN = {
  蛋: 'Egg',
  乳制品: 'Dairy',
  小麦: 'Wheat',
  虾: 'Shrimp',
  蟹: 'Crab',
  荞麦: 'Buckwheat',
  花生: 'Peanut',
  核桃: 'Walnut',
  杏仁: 'Almond',
  鲍鱼: 'Abalone',
  乌贼: 'Squid',
  鲑鱼卵: 'Salmon roe',
  橙: 'Orange',
  腰果: 'Cashew',
  奇异果: 'Kiwi',
  牛肉: 'Beef',
  芝麻: 'Sesame',
  鲑鱼: 'Salmon',
  鲭鱼: 'Mackerel',
  大豆: 'Soy',
  鸡肉: 'Chicken',
  香蕉: 'Banana',
  猪肉: 'Pork',
  桃: 'Peach',
  山药: 'Yam',
  苹果: 'Apple',
  明胶: 'Gelatin',
  夏威夷果: 'Macadamia',
  鲍: 'Abalone',
  鳕鱼: 'Cod',
  鯡魚: 'Herring',
  鲔鱼: 'Tuna',
};

/**
 * 勋章。勋章名不是菜名，是「成就名」—— 属于游戏化 UI 元素，
 * 所以这 27 条整名翻掉，而菜单里的菜名仍然保留原文。
 *
 * `BADGE_DISH_EN` 只用于拼勋章名（「三文鱼寿司首尝勋章」→ Salmon Sushi First Taste），
 * 不影响菜单 / 图鉴里的菜名显示。
 */
const BADGE_DISH_EN = {
  三文鱼寿司: 'Salmon Sushi',
  金枪鱼寿司: 'Tuna Sushi',
  虾寿司: 'Shrimp Sushi',
  玉子烧寿司: 'Tamago Sushi',
  鳗鱼寿司: 'Eel Sushi',
  蟹肉棒寿司: 'Crab Stick Sushi',
  黄瓜卷: 'Cucumber Roll',
  三文鱼刺身: 'Salmon Sashimi',
  金枪鱼刺身: 'Tuna Sashimi',
  甜虾刺身: 'Sweet Shrimp Sashimi',
  炸虾天妇罗: 'Fried Shrimp Tempura',
  炸蔬菜天妇罗: 'Vegetable Tempura',
  煎饺: 'Pan-fried Dumplings',
  味噌汤: 'Miso Soup',
  茶碗蒸: 'Chawanmushi',
  抹茶冰淇淋: 'Matcha Ice Cream',
  红豆和果子: 'Red Bean Wagashi',
  抹茶: 'Matcha',
  乌龙茶: 'Oolong Tea',
  可乐: 'Cola',
  炙烤三文鱼寿司: 'Aburi Salmon Sushi',
  花之恋: 'Blossom Roll',
  旧款花之恋: 'Old-style Blossom Roll',
};

/** 里程碑勋章的整名映射（它们不是「某道菜 + 首尝」的结构）。 */
const BADGE_EN = {
  天妇罗达人: 'Tempura Master',
  三文鱼爱好者: 'Salmon Lover',
  金枪鱼猎人: 'Tuna Hunter',
  甜品控: 'Dessert Fiend',
  生食勇者: 'Raw Food Brave',
};

function dishEn(name) {
  return BADGE_DISH_EN[String(name).trim()] || String(name).trim();
}

function isEn() {
  return locale.value === 'en';
}

/** 地区名。拿不到 code 时原样返回（后端已经给了中文名）。 */
export function regionLabel(code, fallback) {
  if (!isEn()) return fallback || code || '';
  return REGION_EN[code] || fallback || code || '';
}

/** 分类名。未收录的原样返回，不会变成空白。 */
export function catLabel(name) {
  if (!isEn() || !name) return name || '';
  return CATEGORY_EN[String(name).trim()] || name;
}

/** 标签名。 */
export function tagLabel(name) {
  if (!isEn() || !name) return name || '';
  return TAG_EN[String(name).trim()] || name;
}

/** 过敏原中文名 → 英文。传进来的已经是 allergenLabel() 归一后的中文。 */
export function allergenEn(name) {
  if (!name) return '';
  return ALLERGEN_EN[String(name).trim()] || name;
}

/**
 * 勋章名。数据库里是两种拼好的中文：
 *   「三文鱼寿司首尝勋章」「旧款花之恋首尝勋章」「天妇罗达人」
 */
export function badgeLabel(name) {
  if (!isEn() || !name) return name || '';
  const s = String(name).trim();
  if (BADGE_EN[s]) return BADGE_EN[s];
  let m = s.match(/^旧款(.+?)首尝勋章$/);
  if (m) return `Old-style ${dishEn(m[1])} First Taste`;
  m = s.match(/^(.+?)首尝勋章$/);
  if (m) return `${dishEn(m[1])} First Taste`;
  return s;
}

/**
 * 勋章说明。库里存的是两种拼好的中文：
 *   「首次确认吃过「三文鱼寿司」解锁」
 *   「累计确认吃过「油炸」标签菜品 15 次解锁」
 * 里面嵌的菜名/标签名不翻，只把句子骨架换成英文。
 */
export function badgeDesc(desc) {
  if (!isEn() || !desc) return desc || '';
  const s = String(desc).trim();
  let m = s.match(/^首次确认吃过「(.+?)」解锁$/);
  if (m) {
    const d = String(m[1]).trim();
    const name = BADGE_DISH_EN[d] || (/^旧款/.test(d) ? `Old-style ${dishEn(d.slice(2))}` : dishEn(d));
    return `Unlocks after your first ${name}`;
  }
  m = s.match(/^累计确认吃过「(.+?)」标签菜品\s*(\d+)\s*次解锁$/);
  if (m) return `Unlocks after ${m[2]} dishes tagged ${tagLabel(m[1])}`;
  return s;
}
