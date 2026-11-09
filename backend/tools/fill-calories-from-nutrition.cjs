// 只做一件事：把 dishes.calories 的 NULL 用 dish_nutrition.kcal_estimate 填空。
// 只填空值，不覆盖任何已有非空值，不删行、不建表、不改结构。
const { DatabaseSync } = require('node:sqlite');
const dbPath = process.argv[2];
const apply = process.argv[3] === 'apply';
const db = new DatabaseSync(dbPath);

const q = (sql) => db.prepare(sql).all();
const one = (sql) => db.prepare(sql).get();

function snapshot() {
  const tables = q("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((r) => r.name);
  const counts = {};
  for (const t of tables) counts[t] = one(`SELECT COUNT(*) c FROM ${t}`).c;
  return { tables, counts };
}

const before = snapshot();
const target = one(`SELECT COUNT(*) c FROM dishes d JOIN dish_nutrition n ON n.dish_id=d.id
                     WHERE d.calories IS NULL AND n.kcal_estimate IS NOT NULL`).c;

// 记录下来，供改后比对：应恰好只有 calories 这一个字段、只有这批 id 变了
const willChange = q(`SELECT d.id FROM dishes d JOIN dish_nutrition n ON n.dish_id=d.id
                       WHERE d.calories IS NULL AND n.kcal_estimate IS NOT NULL ORDER BY d.id`).map((r) => r.id);
const beforeKcal = new Map(q('SELECT id, calories FROM dishes').map((r) => [r.id, r.calories]));

console.log(`将填空的行数：${target}`);
console.log(`id 范围：${willChange[0]} .. ${willChange[willChange.length - 1]}`);

if (!apply) {
  console.log('\n（预览模式，未写入。加 apply 参数才执行）');
  db.close();
  process.exit(0);
}

db.exec('BEGIN');
const r = db.prepare(
  `UPDATE dishes
      SET calories = (SELECT n.kcal_estimate FROM dish_nutrition n WHERE n.dish_id = dishes.id)
    WHERE calories IS NULL
      AND EXISTS (SELECT 1 FROM dish_nutrition n WHERE n.dish_id = dishes.id AND n.kcal_estimate IS NOT NULL)`
).run();
db.exec('COMMIT');
console.log(`\nUPDATE affected rows = ${Number(r.changes)}`);

const after = snapshot();
const afterKcal = new Map(q('SELECT id, calories FROM dishes').map((r) => [r.id, r.calories]));

console.log('\n== 自证：表与结构 ==');
console.log('  表数量  before=' + before.tables.length + '  after=' + after.tables.length);
const gone = before.tables.filter((t) => !after.tables.includes(t));
const added = after.tables.filter((t) => !before.tables.includes(t));
console.log('  删除的表：' + (gone.length ? gone.join(',') : '无') + ' | 新增的表：' + (added.length ? added.join(',') : '无'));

console.log('\n== 自证：行数（只增不减）==');
let anyLoss = false;
for (const t of before.tables) {
  const d = after.counts[t] - before.counts[t];
  if (d !== 0) console.log(`  ${t}: ${before.counts[t]} -> ${after.counts[t]}  (${d > 0 ? '+' : ''}${d})`);
  if (d < 0) anyLoss = true;
}
console.log('  有无表行数减少：' + (anyLoss ? '有 ← 违规！' : '无'));

console.log('\n== 自证：字段级 ==');
let changed = 0;
let overwritten = 0;
let wrong = 0;
for (const [id, oldV] of beforeKcal) {
  const newV = afterKcal.get(id);
  if (oldV === newV) continue;
  changed++;
  if (oldV !== null) overwritten++;               // 覆盖了原有非空值 → 违规
  const expect = db.prepare('SELECT kcal_estimate k FROM dish_nutrition WHERE dish_id=?').get(id)?.k;
  if (newV !== expect) wrong++;                    // 填进去的值不等于来源 → 错误
}
console.log(`  calories 发生变化的行数：${changed}（应为 ${target}）`);
console.log(`  其中「覆盖了原有非空值」的行数：${overwritten}（必须为 0）`);
console.log(`  填进去的值与 dish_nutrition.kcal_estimate 不一致的行数：${wrong}（必须为 0）`);
console.log(`  dishes.calories 非空：${one('SELECT COUNT(*) c FROM dishes WHERE calories IS NOT NULL').c} / ${one('SELECT COUNT(*) c FROM dishes').c}`);

console.log('\n结论：' + (
  gone.length === 0 && !anyLoss && overwritten === 0 && wrong === 0 && changed === target
    ? '✅ 只填空值，未覆盖、未删除、未改结构'
    : '❌ 有不符合预期的变化，请人工检查'
));
db.close();
