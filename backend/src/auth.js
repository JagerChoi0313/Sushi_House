import crypto from 'node:crypto';

/** 生成 `salt:hash` 形式的密码哈希（scrypt） */
export function makePassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** 校验密码 */
export function checkPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

/** 生成会话令牌（明文返回给客户端，哈希入库） */
export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}
