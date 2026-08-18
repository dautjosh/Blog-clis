# ClickBlog

A self-hosted blog with a login-protected admin panel, a post editor (Markdown), and built-in ad/affiliate slots (header, in-content, sidebar, footer) — no framework, no external database, just Node.js.

## Run it locally

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The first time it runs, it creates an admin account and prints the password to the terminal — copy it before it scrolls away. Log in at **http://localhost:3000/admin/login** and change the password immediately from **Admin → Settings**.

You can also set the initial credentials yourself before the first run:

```bash
ADMIN_USERNAME=you ADMIN_PASSWORD=a-strong-password npm start
```

## Writing posts

Go to **/admin → New post**. Content is written in Markdown. Every published post automatically gets:
- the ad snippet you set as "In-content ad" (inserted after the second paragraph)
- your affiliate disclosure text at the bottom (edit this in Settings — most ad/affiliate networks require a disclosure)

## Adding your ad network or affiliate links

Go to **/admin → Settings**. Paste whatever code your ad network or affiliate program gave you (a `<script>` tag, an `<iframe>`, or a plain link/banner) into any of the four ad slots: header, in-content, sidebar, footer. It's inserted as-is, so only paste code from providers you trust.

Common choices: Google AdSense, Media.net, Ezoic, PropellerAds, or affiliate banners/links from Amazon Associates, ShareASale, Impact, CJ Affiliate, etc. Most of these give you a snippet to paste directly into one of these boxes — no code changes needed.

## Where your data lives

Everything (posts, settings, admin password hash) is stored in `data/db.json`. Back this file up. Don't commit it to a public repo — it contains your password hash and session secret.

## Deploying so the world can see it

This is a plain Node.js app, so it runs on any Node host. A few easy options:

- **Render.com / Railway.app** — connect your GitHub repo (or upload this folder), set the start command to `npm start`, and it deploys automatically. Both have free/cheap tiers.
- **A VPS (DigitalOcean, Linode, etc.)** — `npm install`, then run it with a process manager so it survives reboots:
  ```bash
  npm install -g pm2
  pm2 start server.js --name clickblog
  pm2 save
  ```
  Put it behind Nginx or Caddy for HTTPS and your domain.
- **Fly.io** — works well for small always-on Node apps with a persistent volume for `data/db.json`.

Whichever host you pick, make sure `data/` is on **persistent** storage — some platforms (like Vercel's serverless functions) wipe the filesystem between requests, which would erase your posts. A regular VPS, Render, Railway, or Fly.io all keep a normal disk, so any of those work fine.

## Notes on the "earns on clicks" part

This app doesn't run ads itself — it gives you clean, labeled slots to drop in whichever ad network or affiliate program you sign up with (that's how blogs actually get paid: through the ad network's/affiliate program's own account and payout system, not through the blog software). Typical next steps:
1. Get accepted by an ad network (e.g. AdSense) or affiliate program.
2. Paste their snippet into Settings here.
3. Publish posts that target search traffic for your niche — traffic is what actually drives click revenue.
