import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getDb, initSchema, UPLOAD_DIR, DB_PATH, PROJECT_DIR } from './db.js';
import { seedAll } from './seed.js';
import { sha256 } from './auth.js';
import { matchRoute } from './routes.js';
import { readJson, getQuery, fail } from './util.js';

const PORT = Number(process.env.PORT || 13000);
const HOST = process.env.HOST || '0.0.0.0';

const db = getDb();
initSchema(db);
const seedResult = seedAll(db);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
};

// 世界菜单图片目录
const WORLD_IMG_DIRS = {
  TW: path.join(PROJECT_DIR, 'catalog', 'images'),
  JP: path.join(PROJECT_DIR, 'catalog_jp', 'images'),
  KR: path.join(PROJECT_DIR, 'catalog_kr', 'images'),
  HK: path.join(PROJECT_DIR, 'catalog_hk', 'images'),
  SG: path.join(PROJECT_DIR, 'catalog_sg', 'images'),
  MY: path.join(PROJECT_DIR, 'catalog_my', 'images'),
  ID: path.join(PROJECT_DIR, 'catalog_id', 'images'),
};

function serveFile(res, filePath) {
  if (!existsSync(filePath)) return fail(res, '文件不存在', 404);
  const ext = path.extname(filePath).toLowerCase();
  const buf = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(buf);
}

function extractToken(req) {
  const h = req.headers['authorization'];
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  const x = req.headers['x-token'];
  if (x) return String(x).trim();
  return null;
}

function resolveUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > datetime('now','localtime')`
    )
    .get(sha256(token));
  if (!row || row.status !== 1) return null;
  return row;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return fail(res, 'bad url', 400);
  }
  const pathname = url.pathname;

  // 静态托管上传图片
  // 世界菜单图片：/worldimg/<REGION>/<文件名>
  if (pathname.startsWith('/worldimg/')) {
    const parts = pathname.slice('/worldimg/'.length).split('/');
    if (parts.length !== 2) return fail(res, 'bad path', 400);
    const region = parts[0];
    const dir = WORLD_IMG_DIRS[region];
    if (!dir) return fail(res, '未知地区', 404);
    const file = path.basename(decodeURIComponent(parts[1]));
    return serveFile(res, path.join(dir, file));
  }

  if (pathname.startsWith('/uploads/')) {
    const rel = decodeURIComponent(pathname.slice('/uploads/'.length));
    return serveFile(res, path.join(UPLOAD_DIR, path.basename(rel)));
  }

  const match = matchRoute(req.method, pathname);
  if (!match) return fail(res, '接口不存在', 404);

  const token = extractToken(req);
  const user = resolveUser(db, token);
  if (match.auth === 'user' && !user) return fail(res, '未登录或登录已过期', 401);
  if (match.auth === 'admin' && (!user || user.role !== 'admin')) return fail(res, '需要管理员权限', 403);

  let body = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await readJson(req);
    } catch (e) {
      return fail(res, e.message, 400);
    }
  }

  const ctx = { req, res, db, user, token, params: match.params, query: getQuery(url), body };
  try {
    await match.handler(ctx);
  } catch (e) {
    console.error('[server error]', e);
    if (!res.headersSent) fail(res, '服务器内部错误：' + e.message, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[寿司朗后端] 已启动: http://127.0.0.1:${PORT}`);
  console.log(`[数据库] ${DB_PATH}`);
  console.log(seedResult.skipped ? '[种子数据] 已存在，跳过' : '[种子数据] 已初始化（admin/admin123, demo/demo123）');
});
