# Poimen Deploy Log

---

## 2026-06-28 — Admin Dashboard + Churches + last_seen_at

### What we built
- `churches` table with name + address, admin-only write RLS
- `church_id` FK on profiles (users can select their church)
- `last_seen_at` on profiles (touched silently on every app open)
- Admin dashboard at `/admin` (web-only): summary stats, health metrics, 6-month activity chart, per-church breakdown
- Church picker in profile setup flow (replaces free-text church name field)
- 3 Postgres RPC functions (`get_admin_summary`, `get_monthly_activity`, `get_church_breakdown`) — security definer, return aggregate counts only, no individual content exposed

### Migrations run (in order)
1. `20260628_churches_and_last_seen.sql` — churches table, church_id + last_seen_at on profiles, is_admin() helper, admin-reads-all RLS policy
2. `20260628_admin_rpc.sql` — the 3 admin RPC functions

---

## Deployment Issues & Lessons Learned

### 1. Wrong git author email blocked Vercel auto-deploys
**What happened:** Git global config had `user.email = bsaleeb91@gmail.com` but the Vercel/GitHub account is `bsaleeb@gmail.com`. Vercel silently blocked every auto-deploy with "Fix Git Configuration" error visible only in the Vercel dashboard (not in CLI or GitHub).

**Fix:**
```bash
git config --global user.email "bsaleeb@gmail.com"
git commit --allow-empty -m "fix git author email"
git push origin poimen-main
```

**How to avoid:** Always verify `git config --global user.email` matches your GitHub account email. Check the Vercel dashboard (not just CLI) when auto-deploys stop working.

---

### 2. Vercel cached a stale build on empty commit
**What happened:** After fixing the email, we pushed an empty commit to trigger a deploy. Vercel detected no source file changes and served a cached build from before our admin page changes — deployed in 4 seconds instead of the usual ~1 minute. The page looked unchanged.

**Fix:** Force a fresh build that ignores cache:
```bash
vercel --prod --force
```

**How to spot it:** If a Vercel build completes in under 10 seconds for this project, it used cache. Real builds take ~1 minute.

---

### 3. CLI deploy didn't update poimen-app.vercel.app
**What happened:** `vercel --prod --force` deployed successfully and showed `● Ready` but `poimen-app.vercel.app` still served the old version. The CLI aliased the deployment to a random URL (`dist-beige-theta-54.vercel.app`) instead of the production domain.

**Fix:** Manually alias after each CLI deploy:
```bash
vercel alias set <new-deployment-url> poimen-app.vercel.app
```
Example:
```bash
vercel alias set https://poimen-68jf7rqwg-bishoy-saleeb-s-projects.vercel.app poimen-app.vercel.app
```

**Preferred path going forward:** Push to `poimen-main` via git (auto-deploy) rather than using `vercel --prod` from CLI. With the email fixed, git pushes should auto-deploy and alias correctly without needing the manual alias step.

---

### 4. Vercel production branch vs git branch mismatch (ongoing risk)
**What we know:** Vercel dashboard is set to deploy from `poimen-main`. Confirm this is still set if auto-deploys ever stop working again: Vercel Dashboard → poimen → Settings → Git → Production Branch.

---

## Standard Deploy Checklist

For every release going forward:

1. Run migrations in Supabase SQL editor first
2. `git push origin poimen-main` — watch for Vercel auto-deploy in dashboard
3. If auto-deploy doesn't fire within 2 minutes, check Vercel dashboard for errors (email mismatch, config error, etc.)
4. If manual deploy needed: `vercel --prod --force` then `vercel alias set <url> poimen-app.vercel.app`
5. Hard refresh (`Ctrl+Shift+R`) to verify changes are live
6. If still stale after hard refresh — check build time in Vercel dashboard. Under 10s = cache hit, use `--force`
