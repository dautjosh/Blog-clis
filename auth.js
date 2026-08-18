const crypto = require('crypto');

const SESSION_HOURS = 24 * 7;

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function createSessionToken(username, secret) {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${username}.${expires}`;
  const sig = sign(payload, secret);
  return Buffer.from(`${payload}.${sig}`).toString('base64');
}

function verifySessionToken(token, secret) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('.');
    const sig = parts.pop();
    const expires = parts.pop();
    const username = parts.join('.');
    const payload = `${username}.${expires}`;
    const expected = sign(payload, secret);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    if (Date.now() > Number(expires)) return null;
    return username;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function getSessionUser(req, secret) {
  const cookies = parseCookies(req);
  if (!cookies.session) return null;
  return verifySessionToken(cookies.session, secret);
}

module.exports = { createSessionToken, verifySessionToken, parseCookies, getSessionUser };
