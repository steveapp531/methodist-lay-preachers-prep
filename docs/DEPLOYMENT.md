# Deployment

Getting the platform onto the internet: MongoDB Atlas for the database, Render for the API,
Vercel or Netlify for the web client.

Budget about an hour the first time. Three settings account for almost every failed deployment and
each is flagged below.

---

## Before you start

You need accounts on GitHub, MongoDB Atlas, Render, and Vercel or Netlify. All four have a free
tier sufficient for this.

Generate two secrets now and keep them somewhere safe:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_REFRESH_SECRET
```

They must be different from each other, and neither may be the placeholder in `.env.example`.

---

## 1. Push to GitHub

```bash
cd methodist-lay-preachers-prep
git init
git add .
git status          # confirm no .env, no node_modules, no .docx or .pdf
git commit -m "Lay Preachers' Examination preparation platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/methodist-lay-preachers-prep.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `node_modules/`, `.data/`, `frontend/dist/` and
`data/source/`.

**Make the repository private** if it contains syllabus content. That material belongs to the
Methodist Church Ghana and is included for candidates' personal study, not for redistribution.

Check nothing sensitive slipped through before you push:

```bash
git grep -nE "(mongodb\+srv://|sk-ant-|JWT_.*SECRET=[a-f0-9]{32})" -- ':!*.example' ':!docs/*'
```

That should print nothing.

---

## 2. MongoDB Atlas

1. Create a project, then **Build a Database** → **M0** (free). Pick a region near Ghana —
   `eu-west-1` (Ireland) or `eu-central-1` (Frankfurt) are the usual choices.
2. **Database Access** → **Add New Database User**. Username and a generated password; role
   **Read and write to any database**. Copy the password now.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   Render does not publish fixed outbound addresses on the free tier, so this is necessary. The
   database is still protected by its credentials.
4. **Database** → **Connect** → **Drivers** → copy the connection string and edit it:

```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/mlpp?retryWrites=true&w=majority
```

Replace `USERNAME` and `PASSWORD`, and note the `/mlpp` before the `?` — without a database name
Mongo uses `test`. If your password contains `@ : / ? # [ ] %`, URL-encode it (`@` → `%40`).

---

## 3. The API on Render

**New** → **Web Service** → connect your repository.

| Setting | Value |
| --- | --- |
| Name | `lay-preachers-api` |
| Region | Frankfurt or Ohio |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

### Environment variables

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string |
| `JWT_ACCESS_SECRET` | the first generated secret |
| `JWT_REFRESH_SECRET` | the second generated secret |
| `CORS_ORIGINS` | `https://methodist-lay-preachers-prep.vercel.app` |
| `TRUST_PROXY` | `true` |
| `ACCESS_TOKEN_TTL` | `30m` |
| `REFRESH_TOKEN_TTL` | `30d` |

Add `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` only if you want AI-assisted theory marking.
Theory answers are marked either way.

> **Note on the root directory.** The repository is an npm workspace, and `backend` depends on
> `../shared/constants.js`. Render clones the whole repository and then runs from `backend`, so
> that relative import resolves normally. Do not try to deploy `backend/` as a detached folder.

Deploy, then check:

```
https://lay-preachers-api.onrender.com/api/health
```

You should get `{"success":true,"data":{"status":"ok", …}}`.

> **The free tier sleeps** after 15 minutes idle, and the next request takes 30–60 seconds to wake
> it. That is bearable for personal study and irritating for a group. Render's cheapest paid
> instance removes it.

---

## 4. The web client

### Vercel

**Add New** → **Project** → import the repository.

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | leave as the repository root |
| Build Command | `npm run build` |
| Output Directory | `frontend/dist` |
| Install Command | `npm install` |

Environment variable:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://methodist-lay-preachers-prep.onrender.com/api` |

**Include `/api` at the end.** Leaving it off is the single most common mistake here — every
request 404s.

Client-side routing needs a rewrite so that a deep link such as `/study/topic/abc` reaches
`index.html` rather than 404ing. Create `vercel.json` in the repository root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Netlify instead

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `frontend/dist` |

Same `VITE_API_URL` variable, and create `frontend/public/_redirects`:

```
/*    /index.html   200
```

---

## 5. Close the CORS loop

Go back to Render and set `CORS_ORIGINS` to your deployed web address, exactly:

```
CORS_ORIGINS=https://methodist-lay-preachers-prep.vercel.app
```

No trailing slash. No path. Several origins are comma-separated, which is how you add a custom
domain later:

```
CORS_ORIGINS=https://your-app.vercel.app,https://prep.yourdomain.org
```

Render redeploys on save. Until this is right, sign-in appears to succeed and then immediately
signs you out.

---

## 6. Seed the production database

The seed reads `data/part2/`, which lives in the repository, so run it from your own machine
against Atlas.

```bash
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/mlpp?retryWrites=true&w=majority" \
NODE_ENV=production \
JWT_ACCESS_SECRET="anything-long-enough-for-this-command" \
JWT_REFRESH_SECRET="anything-else-long-enough-for-this" \
npm run seed
```

Expect roughly:

```
Manual loaded: 6 subjects, 48 chapters, 317 topics
Scripture index built: 1010 distinct references
questions.manual.json: 1392 created, 0 updated, 0 skipped
Flashcards: 360 loaded
Mock examinations ready for 6 papers
```

Then create your administrator against the same database:

```bash
MONGODB_URI="…" NODE_ENV=production \
JWT_ACCESS_SECRET="…" JWT_REFRESH_SECRET="…" \
npm run create:admin
```

Alternatively use Render's **Shell** tab and run `npm run seed` there, where the environment is
already set.

---

## 7. Check it end to end

1. Open your web address. The landing page should list the six papers — that proves the client can
   reach the API, since those come from `/api/exams`.
2. Register an account and choose Part 2.
3. Reload the page. You should still be signed in — that proves the refresh cookie is working
   across origins.
4. Open a topic under Study. You should see syllabus text.
5. Take a five-question quiz. Answer one wrong on purpose and check the feedback shows the correct
   answer, the reason and the syllabus reference.
6. Start a mock examination, answer a question, close the tab, reopen the sitting. Your answer
   should be there and the clock should have kept running.
7. Sign in as the administrator and open the admin overview.

---

## Production settings that catch people out

**CORS.** `CORS_ORIGINS` must match the browser's origin exactly — scheme, host, no trailing slash.

**Cookies.** In production the refresh cookie is `SameSite=None; Secure`, because the API and the
client are on different hosts. Both must be served over HTTPS, which Render and Vercel do by
default. Over plain HTTP the browser silently drops the cookie and every reload signs you out.

**Proxies.** `TRUST_PROXY=true` on Render, or rate limiting sees the proxy's address for every
request and one busy candidate locks out everybody.

**Secrets.** The API refuses to start in production if either JWT secret is missing or shorter than
16 characters. That is deliberate.

**The database.** `MONGODB_URI` is required in production; the embedded development database is
refused there.

---

## Troubleshooting

**Render build fails: "Cannot find module '../../shared/constants.js'"**
The root directory is wrong or the repository was not cloned whole. Root Directory must be
`backend`, and `shared/` must be committed.

**Every API call fails with a CORS error**
`CORS_ORIGINS` does not match. Compare it against the address bar character by character. A
trailing slash is enough to break it.

**Sign-in works, then immediately signs out on reload**
The refresh cookie is not being stored. Confirm both ends are HTTPS, `NODE_ENV=production` on
Render, and `VITE_API_URL` points at the API over HTTPS.

**Everything 404s from the client**
`VITE_API_URL` is missing `/api`, or it was set after the build. Vite inlines environment variables
at build time, so redeploy the client after changing it.

**A deep link 404s but the home page works**
The SPA rewrite is missing — `vercel.json` or `_redirects` above.

**"MONGODB_URI is required in production"**
It is unset, or misspelled, on Render.

**Atlas connection times out**
Network Access does not allow `0.0.0.0/0`, or the password in the URI is not URL-encoded.

**The first request each morning takes a minute**
The free Render instance sleeping. Expected.

**Theory answers all score low**
No AI key is set, so the rubric engine is marking on keyword and synonym coverage. Either improve
the rubrics' `synonyms`, or set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.

---

## Keeping it updated

```bash
git add .
git commit -m "…"
git push
```

Render and Vercel both redeploy on push to `main`.

After changing content in `data/part2/`, re-run the seed against Atlas. It upserts, so existing
progress is untouched:

```bash
MONGODB_URI="…" NODE_ENV=production JWT_ACCESS_SECRET="…" JWT_REFRESH_SECRET="…" npm run seed
```

Use `npm run seed:reset` only if you want to clear and reload all content. It never touches user
accounts or their progress, but any question it deletes and recreates gets a new id, which orphans
the attempt history pointing at it.

---

## A note on sharing this with other candidates

If you open it up beyond yourself:

- Move off the free Render tier, or the first person each morning waits a minute.
- Keep the repository private. The syllabus content is not yours to redistribute.
- Watch the administrator dashboard's content health panel. Questions marked `unverified` are held
  back from candidates by design; confirm them against the printed syllabus before publishing.
- If you enable AI marking, the key is yours and every marked theory answer costs you something.
  The rubric engine costs nothing and is the default for good reason.
