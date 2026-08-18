const { escapeHtml, renderMarkdown, insertInContentAd } = require('./markdown');

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function layout({ title, tagline, body, headExtra = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/style.css">
${headExtra}
</head>
<body>
${body}
</body>
</html>`;
}

function siteHeader(settings) {
  return `<header class="site-header"><div class="wrap">
    <div>
      <a class="site-title" href="/">${escapeHtml(settings.siteTitle)}</a>
      <div class="site-tagline">${escapeHtml(settings.siteTagline)}</div>
    </div>
    <nav class="header-nav"><a href="/admin">Admin</a></nav>
  </div></header>`;
}

function siteFooter(settings) {
  return `<footer class="site-footer"><div class="wrap">
    <span>&copy; ${new Date().getFullYear()} ${escapeHtml(settings.siteTitle)}</span>
    ${settings.adFooter ? `<div class="ad-slot ad-footer">${settings.adFooter}</div>` : ''}
  </div></footer>`;
}

function homePage(settings, posts) {
  const list = posts.length
    ? posts
        .map(
          (p) => `<article class="post-list-item">
        <span class="eyebrow">${fmtDate(p.createdAt)}</span>
        <h2><a href="/post/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h2>
        <p class="post-excerpt">${escapeHtml(p.excerpt)}</p>
      </article>`
        )
        .join('\n')
    : `<div class="empty-state">No posts published yet. Log into /admin to write your first one.</div>`;

  const body = `
    ${siteHeader(settings)}
    <main>
      ${settings.adHeader ? `<div class="ad-slot">${settings.adHeader}</div>` : ''}
      ${list}
    </main>
    ${siteFooter(settings)}
  `;
  return layout({ title: settings.siteTitle, body });
}

function postPage(settings, post) {
  let html = renderMarkdown(post.content);
  html = insertInContentAd(html, settings.adInContent);
  const body = `
    ${siteHeader(settings)}
    <main>
      <article>
        <div class="post-header">
          <span class="eyebrow">${fmtDate(post.createdAt)}</span>
          <h1 class="post-title">${escapeHtml(post.title)}</h1>
        </div>
        ${post.coverImage ? `<img class="post-cover" src="${escapeHtml(post.coverImage)}" alt="">` : ''}
        <div class="post-body">${html}</div>
        ${settings.affiliateDisclosure ? `<div class="disclosure">${escapeHtml(settings.affiliateDisclosure)}</div>` : ''}
        <a class="back-link" href="/">&larr; Back to all posts</a>
      </article>
    </main>
    ${siteFooter(settings)}
  `;
  return layout({ title: `${post.title} — ${settings.siteTitle}`, body });
}

function loginPage({ error } = {}) {
  const body = `
  <div class="login-shell">
    <div class="login-card">
      <h1>Admin login</h1>
      ${error ? `<div class="flash-error">${escapeHtml(error)}</div>` : ''}
      <form class="stacked" method="post" action="/admin/login">
        <label>Username</label>
        <input type="text" name="username" required autofocus>
        <label>Password</label>
        <input type="password" name="password" required>
        <div class="actions"><button class="btn" type="submit">Log in</button></div>
      </form>
    </div>
  </div>`;
  return layout({ title: 'Admin login', body });
}

function adminTopbar(active) {
  const link = (href, label, key) =>
    `<a href="${href}" style="${active === key ? 'opacity:1;text-decoration:underline;' : ''}">${label}</a>`;
  return `<div class="admin-topbar"><div class="wrap">
    <span class="brand">Admin</span>
    <div>
      ${link('/admin', 'Posts', 'posts')}
      ${link('/admin/new', 'New post', 'new')}
      ${link('/admin/settings', 'Settings', 'settings')}
      ${link('/', 'View site', '')}
      ${link('/admin/logout', 'Log out', '')}
    </div>
  </div></div>`;
}

function adminDashboard(posts, flash) {
  const rows = posts.length
    ? posts
        .map(
          (p) => `<tr>
        <td><strong>${escapeHtml(p.title)}</strong><br><span class="row-actions" style="font-family:'IBM Plex Mono',monospace;color:#8a8478;">/post/${escapeHtml(p.slug)}</span></td>
        <td><span class="status-pill ${p.published ? 'published' : 'draft'}">${p.published ? 'Published' : 'Draft'}</span></td>
        <td>${fmtDate(p.updatedAt)}</td>
        <td class="row-actions">
          <a href="/admin/edit/${p.id}">Edit</a>
          <form method="post" action="/admin/delete/${p.id}" style="display:inline" onsubmit="return confirm('Delete this post?');">
            <button type="submit">Delete</button>
          </form>
        </td>
      </tr>`
        )
        .join('\n')
    : `<tr><td colspan="4" style="color:#8a8478;">No posts yet. <a href="/admin/new">Write your first one</a>.</td></tr>`;

  const body = `
  ${adminTopbar('posts')}
  <div class="admin-shell">
    ${flash ? `<div class="flash-ok">${escapeHtml(flash)}</div>` : ''}
    <div class="panel">
      <h2>Posts</h2>
      <table class="post-table">
        <thead><tr><th>Title</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
  return layout({ title: 'Admin · Posts', body });
}

function postForm(post, { errors = [] } = {}) {
  const isEdit = !!post.id;
  const action = isEdit ? `/admin/edit/${post.id}` : '/admin/new';
  const body = `
  ${adminTopbar(isEdit ? 'posts' : 'new')}
  <div class="admin-shell">
    <div class="panel">
      <h2>${isEdit ? 'Edit post' : 'New post'}</h2>
      ${errors.length ? `<div class="flash-error">${errors.map(escapeHtml).join('<br>')}</div>` : ''}
      <form class="stacked" method="post" action="${action}">
        <label>Title</label>
        <input type="text" name="title" value="${escapeHtml(post.title || '')}" required>

        <label>Slug (URL path)</label>
        <input type="text" name="slug" value="${escapeHtml(post.slug || '')}" placeholder="auto-generated from title if left blank">
        <div class="hint">Final URL: /post/your-slug</div>

        <label>Excerpt</label>
        <textarea name="excerpt" rows="2">${escapeHtml(post.excerpt || '')}</textarea>
        <div class="hint">Shown on the homepage list.</div>

        <label>Cover image URL (optional)</label>
        <input type="url" name="coverImage" value="${escapeHtml(post.coverImage || '')}" placeholder="https://...">

        <label>Content (Markdown)</label>
        <textarea class="content-area" name="content">${escapeHtml(post.content || '')}</textarea>
        <div class="hint">An in-content ad slot is inserted automatically after the second paragraph.</div>

        <div class="checkbox-row">
          <input type="checkbox" name="published" id="published" ${post.published ? 'checked' : ''}>
          <label for="published" style="margin:0;text-transform:none;font-family:inherit;">Published (visible on the site)</label>
        </div>

        <div class="actions">
          <button class="btn" type="submit">${isEdit ? 'Save changes' : 'Create post'}</button>
          <a class="btn secondary" href="/admin">Cancel</a>
        </div>
      </form>
    </div>
  </div>`;
  return layout({ title: isEdit ? 'Edit post' : 'New post', body });
}

function settingsForm(settings, { flash } = {}) {
  const body = `
  ${adminTopbar('settings')}
  <div class="admin-shell">
    ${flash ? `<div class="flash-ok">${escapeHtml(flash)}</div>` : ''}
    <div class="panel">
      <h2>Site</h2>
      <form class="stacked" method="post" action="/admin/settings">
        <label>Site title</label>
        <input type="text" name="siteTitle" value="${escapeHtml(settings.siteTitle)}">
        <label>Tagline</label>
        <input type="text" name="siteTagline" value="${escapeHtml(settings.siteTagline)}">
        <label>Affiliate disclosure</label>
        <textarea name="affiliateDisclosure" rows="2">${escapeHtml(settings.affiliateDisclosure)}</textarea>
        <div class="hint">Shown at the bottom of every post — most ad/affiliate networks require this.</div>

        <label>Header ad / banner (HTML or script snippet)</label>
        <textarea class="ad-area" name="adHeader">${escapeHtml(settings.adHeader)}</textarea>

        <label>In-content ad (shown inside every post)</label>
        <textarea class="ad-area" name="adInContent">${escapeHtml(settings.adInContent)}</textarea>

        <label>Sidebar ad</label>
        <textarea class="ad-area" name="adSidebar">${escapeHtml(settings.adSidebar)}</textarea>

        <label>Footer ad</label>
        <textarea class="ad-area" name="adFooter">${escapeHtml(settings.adFooter)}</textarea>
        <div class="hint">Paste whatever your ad network or affiliate program gives you (script tag, iframe, or a plain link/banner). It's inserted as-is, so only paste code you trust.</div>

        <div class="actions"><button class="btn" type="submit">Save settings</button></div>
      </form>
    </div>

    <div class="panel">
      <h2>Change admin password</h2>
      <form class="stacked" method="post" action="/admin/settings/password">
        <label>Current password</label>
        <input type="password" name="currentPassword" required>
        <label>New password</label>
        <input type="password" name="newPassword" required minlength="8">
        <div class="actions"><button class="btn" type="submit">Update password</button></div>
      </form>
    </div>
  </div>`;
  return layout({ title: 'Admin · Settings', body });
}

function notFoundPage() {
  return layout({
    title: 'Not found',
    body: `<main style="max-width:600px;margin:80px auto;text-align:center;font-family:'IBM Plex Mono',monospace;">
      <h1 style="font-family:'Fraunces',serif;">404</h1>
      <p>That page doesn't exist. <a href="/">Go home</a>.</p>
    </main>`,
  });
}

module.exports = {
  homePage,
  postPage,
  loginPage,
  adminDashboard,
  postForm,
  settingsForm,
  notFoundPage,
};
