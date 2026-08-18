const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function defaultDb() {
  const initialPassword = process.env.ADMIN_PASSWORD || 'changeme123';
  return {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    admin: {
      username: process.env.ADMIN_USERNAME || 'admin',
      passwordHash: hashPassword(initialPassword),
    },
    settings: {
      siteTitle: 'The Field Notes',
      siteTagline: 'Notes worth clicking on.',
      affiliateDisclosure:
        'Some links on this site are affiliate links. If you click through and make a purchase, we may earn a small commission at no extra cost to you.',
      adHeader: '',
      adInContent: '',
      adSidebar: '',
      adFooter: '',
    },
    posts: [
      {
        id: 1,
        slug: 'welcome-to-your-blog',
        title: 'Welcome to your new blog',
        excerpt: 'A quick tour of what you can do here, and where to paste your ad code.',
        coverImage: '',
        content:
          '## You\'re live\n\nThis post is here so you can see how a real post looks with an in-content ad slot dropped into it.\n\nHead to **/admin** to log in, edit this post, or write a new one. Go to **Settings** to paste in your ad network snippet or affiliate banner code — it will automatically show up in the header, sidebar, footer, and inside every post.\n\nWhen you\'re ready, delete this post and start publishing.',
        published: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    nextId: 2,
    _initialPasswordNotice: process.env.ADMIN_PASSWORD ? null : initialPassword,
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const db = defaultDb();
    save(db);
    if (db._initialPasswordNotice) {
      console.log('====================================================');
      console.log(' First run — admin account created:');
      console.log('   username: ' + db.admin.username);
      console.log('   password: ' + db._initialPasswordNotice);
      console.log(' Change this from /admin/settings after logging in.');
      console.log('====================================================');
    }
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = { load, save, hashPassword, verifyPassword };
