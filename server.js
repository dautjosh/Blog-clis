const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const db = require('./lib/db');
const { hashPassword, verifyPassword } = require('./lib/db');
const { createSessionToken, getSessionUser, parseCookies } = require('./lib/auth');
const views = require('./lib/views');

const PORT = process.env.PORT || 3000;
let state = db.load();

function persist() {
  db.save(state);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function uniqueSlug(base, ignoreId) {
  let slug = base || 'post';
  let i = 2;
  while (state.posts.some((p) => p.slug === slug && p.id !== ignoreId)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function parseForm(req) {
  const raw = await readBody(req);
  return querystring.parse(raw);
}

const MIME = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  const filePath = path.join(__dirname, 'public', pathname);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) return false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function requireAuth(req) {
  return !!getSessionUser(req, state.sessionSecret);
}

async function handle(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);
  const method = req.method;

  // Static files
  if (method === 'GET' && (pathname === '/style.css' || pathname.startsWith('/assets/'))) {
    if (serveStatic(req, res, pathname)) return;
  }

  // ---------- Public site ----------
  if (method === 'GET' && pathname === '/') {
    const posts = state.posts
      .filter((p) => p.published)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendHtml(res, 200, views.homePage(state.settings, posts));
  }

  if (method === 'GET' && pathname.startsWith('/post/')) {
    const slug = pathname.replace('/post/', '');
    const post = state.posts.find((p) => p.slug === slug && p.published);
    if (!post) return sendHtml(res, 404, views.notFoundPage());
    return sendHtml(res, 200, views.postPage(state.settings, post));
  }

  // ---------- Admin auth ----------
  if (method === 'GET' && pathname === '/admin/login') {
    if (requireAuth(req)) return redirect(res, '/admin');
    return sendHtml(res, 200, views.loginPage());
  }

  if (method === 'POST' && pathname === '/admin/login') {
    const form = await parseForm(req);
    const { username, password } = form;
    const ok =
      username === state.admin.username &&
      password &&
      verifyPassword(String(password), state.admin.passwordHash);
    if (!ok) return sendHtml(res, 401, views.loginPage({ error: 'Incorrect username or password.' }));
    const token = createSessionToken(username, state.sessionSecret);
    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
    return redirect(res, '/admin');
  }

  if (method === 'GET' && pathname === '/admin/logout') {
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
    return redirect(res, '/admin/login');
  }

  // ---------- Admin (protected) ----------
  if (pathname.startsWith('/admin')) {
    if (!requireAuth(req)) return redirect(res, '/admin/login');

    if (method === 'GET' && pathname === '/admin') {
      const posts = [...state.posts].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      const flash = parsed.query.saved ? 'Saved.' : parsed.query.deleted ? 'Post deleted.' : null;
      return sendHtml(res, 200, views.adminDashboard(posts, flash));
    }

    if (method === 'GET' && pathname === '/admin/new') {
      return sendHtml(res, 200, views.postForm({}));
    }

    if (method === 'POST' && pathname === '/admin/new') {
      const form = await parseForm(req);
      const title = (form.title || '').trim();
      if (!title) return sendHtml(res, 400, views.postForm(form, { errors: ['Title is required.'] }));
      const base = slugify(form.slug || title);
      const slug = uniqueSlug(base || 'post');
      const now = new Date().toISOString();
      const post = {
        id: state.nextId++,
        slug,
        title,
        excerpt: (form.excerpt || '').trim(),
        coverImage: (form.coverImage || '').trim(),
        content: form.content || '',
        published: form.published === 'on',
        createdAt: now,
        updatedAt: now,
      };
      state.posts.push(post);
      persist();
      return redirect(res, '/admin?saved=1');
    }

    const editMatch = pathname.match(/^\/admin\/edit\/(\d+)$/);
    if (editMatch) {
      const id = Number(editMatch[1]);
      const post = state.posts.find((p) => p.id === id);
      if (!post) return sendHtml(res, 404, views.notFoundPage());

      if (method === 'GET') return sendHtml(res, 200, views.postForm(post));

      if (method === 'POST') {
        const form = await parseForm(req);
        const title = (form.title || '').trim();
        if (!title)
          return sendHtml(res, 400, views.postForm({ ...post, ...form }, { errors: ['Title is required.'] }));
        const base = slugify(form.slug || title);
        post.slug = uniqueSlug(base || 'post', post.id);
        post.title = title;
        post.excerpt = (form.excerpt || '').trim();
        post.coverImage = (form.coverImage || '').trim();
        post.content = form.content || '';
        post.published = form.published === 'on';
        post.updatedAt = new Date().toISOString();
        persist();
        return redirect(res, '/admin?saved=1');
      }
    }

    const deleteMatch = pathname.match(/^\/admin\/delete\/(\d+)$/);
    if (deleteMatch && method === 'POST') {
      const id = Number(deleteMatch[1]);
      state.posts = state.posts.filter((p) => p.id !== id);
      persist();
      return redirect(res, '/admin?deleted=1');
    }

    if (pathname === '/admin/settings') {
      if (method === 'GET') return sendHtml(res, 200, views.settingsForm(state.settings));
      if (method === 'POST') {
        const form = await parseForm(req);
        state.settings = {
          siteTitle: form.siteTitle || state.settings.siteTitle,
          siteTagline: form.siteTagline || '',
          affiliateDisclosure: form.affiliateDisclosure || '',
          adHeader: form.adHeader || '',
          adInContent: form.adInContent || '',
          adSidebar: form.adSidebar || '',
          adFooter: form.adFooter || '',
        };
        persist();
        return sendHtml(res, 200, views.settingsForm(state.settings, { flash: 'Settings saved.' }));
      }
    }

    if (pathname === '/admin/settings/password' && method === 'POST') {
      const form = await parseForm(req);
      const { currentPassword, newPassword } = form;
      if (!verifyPassword(String(currentPassword || ''), state.admin.passwordHash)) {
        return sendHtml(res, 401, views.settingsForm(state.settings, { flash: null }).replace(
          '<div class="admin-shell">',
          '<div class="admin-shell"><div class="flash-error">Current password is incorrect.</div>'
        ));
      }
      if (!newPassword || newPassword.length < 8) {
        return sendHtml(res, 400, views.settingsForm(state.settings).replace(
          '<div class="admin-shell">',
          '<div class="admin-shell"><div class="flash-error">New password must be at least 8 characters.</div>'
        ));
      }
      state.admin.passwordHash = hashPassword(String(newPassword));
      persist();
      return sendHtml(res, 200, views.settingsForm(state.settings, { flash: 'Password updated.' }));
    }
  }

  return sendHtml(res, 404, views.notFoundPage());
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    sendHtml(res, 500, '<h1>500 — something broke</h1>');
  });
});

server.listen(PORT, () => {
  console.log(`ClickBlog running at http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/login`);
});
