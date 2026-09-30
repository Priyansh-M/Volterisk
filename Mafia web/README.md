# Volterisk

The playable client is Volterisk. Underneath it is the same ledger: a browser heist game. You keep cash and a vault. Other players (and seeded night-crew ledgers) can be robbed only while their vault is vulnerable. The server rolls the job. The client never sends weapon level, vault level, chance, or reward.

All game code lives in this folder.

## Auth

Send `Authorization: Bearer <token>` on every route except register and login. Logout bumps a token version, so the old bearer stops working.

## Run (VS Code, PowerShell)

Two terminals, from the repo root.

```powershell
cd "Mafia web\server"
npm install
npm run db:push
npm run db:seed
npm run dev
```

```powershell
cd "Mafia web\client"
npm install
npm run dev
```

Tests:

```powershell
cd "Mafia web\server"
npm test
```

Bash is the same with `Mafia web/server` and `Mafia web/client`.

- API: http://localhost:8787 (bound to `0.0.0.0`)
- Client: http://localhost:4178 (bound to `0.0.0.0`, proxies `/api` to the API)

`server/.env` is a local default (`JWT_SECRET=iron-hour-local-dev`, SQLite file `server/data/dev.db`). Leave that file on SQLite. Publishing uses a separate Supabase Postgres database and two Vercel projects. The commands are in the Publish section below.

## Config

Every gameplay number is on `RULES` in `server/src/game/rules.ts`.

| Knob | Default |
| --- | --- |
| `MIN_VAULT_BALANCE` | 10000 |
| `TARGET_PROTECTION_HOURS` | 12 |
| `HEIST_COOLDOWN_MINUTES` | 15 |
| `HEIST_REWARD_PERCENT` | 10 (hard max 10) |
| `STARTING_CASH` | 1000 |
| `STARTING_VAULT_BALANCE` | 25000 |
| Vault upgrade costs | 1→2 $25,000, 2→3 $75,000, 3→4 $200,000, then up through level 10 |
| Weapon buy / upgrade costs | tables in the same object |

New users own `weapon:0001` (Rusty Crowbar) at upgrade 1, equipped.

## Formulas

Effective combat level, in `rules.ts`:

```
(weaponNumber - 1) * 3 + upgradeLevel
```

Weapon N at upgrade 1 equals weapon N-1 at upgrade 4. Upgrade level is an integer from 1 to 4.

Success chance, only in `server/src/game/probability.ts`:

```
levelDifference = weaponLevel - vaultLevel
successChance = clamp(60 + levelDifference * 8, 10, 95)
```

`weaponLevel` is the effective combat level. Worked examples: 1 vs 1 = 60, 2 vs 1 = 68, 1 vs 2 = 52, 1 vs 4 = 36. The step is 8 because those examples do not hold at 4 points per level.

On a hit, the take is `floor(vaultBalance * rewardPercent / 100)` inside a transaction with a conditional vault update. A miss pays nothing and still starts cooldown. The target is notified in the database either way.

## Screens

Framed night-ledger UI: top bar (title, cash, display-only heat from job count), left nav, city map with original SVG buildings, market shop for weapons `weapon:0001`–`0005`. Crew, intel, and items are marked Soon. Gameplay, formulas, and APIs are unchanged.

## Artwork

Original inline SVG only (wordmark wheel, city map, weapon cards, favicon). No downloaded images. Google Fonts: Cinzel + Outfit.

## API

`GET /api/health`

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`

`GET /api/me`, `GET /api/me/vault`, `GET /api/me/weapons`

`GET /api/heists/targets`, `GET /api/heists/preview`, `POST /api/heists`, `GET /api/heists/history`

`POST /api/vault/upgrade`, `POST /api/vault/withdraw`

`POST /api/weapons/buy`, `POST /api/weapons/upgrade`, `POST /api/weapons/equip`

`GET /api/leaderboard`, `GET /api/notifications`

Heist body is only `{ "targetUserId", "weaponId" }`.

## Publish (Supabase + Vercel + GitHub)

Local play does not change. The live site is two Vercel projects from one GitHub repo: the API (`Mafia web/server`) and the client (`Mafia web/client`). The API uses Supabase Postgres. The client is built with `VITE_API_URL` set to that API origin (no trailing slash).

Create the tables once from PowerShell, after the Supabase URLs are in the terminal and not in `server/.env`:

```powershell
cd "C:\Users\Priyansh\Documents\genesis\Mafia web\server"
npm install
$env:DATABASE_URL = "postgresql://postgres.PROJECT:ENCODED_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
$env:DIRECT_URL = "postgresql://postgres.PROJECT:ENCODED_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
npm run db:push:supabase
```

Copy both URLs from the Supabase Connect dialog. `DATABASE_URL` is the transaction pooler (port 6543) plus `pgbouncer=true` and `connection_limit=1`. `DIRECT_URL` is the session pooler (port 5432) with no `pgbouncer`. URL-encode the password. Close that terminal when the push finishes.

Vercel API project: root directory `Mafia web/server`, framework Express, build command `npm run vercel-build`. Environment variables `DATABASE_URL`, `DIRECT_URL`, and a new `JWT_SECRET` (not `iron-hour-local-dev`), for Production and Preview. Open `https://YOUR-API.vercel.app/api/health` and expect `{"ok":true}`.

Vercel client project: same repo, root directory `Mafia web/client`, framework Vite. Set `VITE_API_URL` to `https://YOUR-API.vercel.app` before the first deploy. Register on the client URL.
