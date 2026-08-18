const path = require('path');

let marked;
try {
  // Normal path: works once `npm install` has been run (see package.json).
  ({ marked } = require('marked'));
} catch (e1) {
  try {
    // Fallback used only inside the build/preview sandbox.
    ({ marked } = require('/home/claude/.npm-global/lib/node_modules/marked'));
  } catch (e2) {
    marked = null;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(md) {
  if (marked) return marked.parse(md || '');
  // Minimal fallback if 'marked' isn't resolvable at deploy time: paragraphs only.
  return String(md || '')
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

// Insert a trusted ad/affiliate HTML snippet after the second paragraph of rendered content.
function insertInContentAd(html, adSnippet) {
  if (!adSnippet || !adSnippet.trim()) return html;
  const closes = [...html.matchAll(/<\/p>/g)];
  if (closes.length < 2) return html + `\n<div class="ad-slot ad-in-content">${adSnippet}</div>`;
  const cut = closes[1].index + '</p>'.length;
  return (
    html.slice(0, cut) +
    `\n<div class="ad-slot ad-in-content">${adSnippet}</div>\n` +
    html.slice(cut)
  );
}

module.exports = { renderMarkdown, escapeHtml, insertInContentAd };
