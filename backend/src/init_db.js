import { getDb, initSchema, DB_PATH } from './db.js';
import { seedAll } from './seed.js';

const db = getDb();
initSchema(db);
const result = seedAll(db);

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all();

console.log('数据库文件:', DB_PATH);
console.log('建表数量:', tables.length);
for (const t of tables) {
  const n = db.prepare(`SELECT COUNT(*) c FROM "${t.name}"`).get().c;
  console.log(`  - ${t.name}: ${n} 行`);
}
console.log(result.skipped ? '（已有数据，跳过种子数据）' : '种子数据已写入（admin/admin123, demo/demo123）');
db.close();
