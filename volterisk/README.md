# Volterisk

The playable client is Volterisk. Underneath it is the same ledger: a browser heist game. You keep cash and a vault. Other players (and seeded night-crew ledgers) can be robbed only while their vault is vulnerable. The server rolls the job. The client never sends weapon level, vault level, chance, or reward.

All game code lives in this folder.

## Auth

Send `Authorization: Bearer <token>` on every route except register and login. Logout bumps a token version, so the old bearer stops working.

## Run (VS Code, PowerShell)

Two terminals, from the repo root.

```powershell
cd "volterisk\server"
npm install
npm run db:push
npm run db:seed
npm run dev
```

```powershell
cd "volterisk\client"
npm install
npm run dev
```

Tests:

```powershell
cd "volterisk\server"
npm test
```

Bash is the same with `volterisk/server` and `volterisk/client`.

- API: http://localhost:8787 (bound to `0.0.0.0`)
- Client: http://localhost:4178 (bound to `0.0.0.0`, proxies `/api` to the API)

Publishing uses Supabase Postgres and one Vercel project. Put the Supabase URLs in `server/.env` on your PC. That file is not uploaded to GitHub. The commands are in the Publish section below.

## Config

Every gameplay number is on `RULES` in `server/src/game/rules.ts`.

| Knob | Default |
| --- | --- |
| `MIN_VAULT_BALANCE` | 10000 |
| `TARGET_PROTECTION_HOURS` | 12 |
| `HEIST_COOLDOWN_MINUTES` | 15 |
| `PLAYER_STEAL_PERCENT_*` | 1–15% of vault; 4% chance of 35–55% |
| `NPC_STEAL_PERCENT_*` | 1–15% of purse |
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

## Publish (Supabase + one Vercel project)

Local play does not change: the API on port 8787, the client on port 4178, with Vite proxying `/api`. The live site is one Vercel project rooted at `volterisk`. It serves the built client from `client/dist` and the Express API at `/api`. Supabase Postgres is still the database. Leave `VITE_API_URL` unset so the browser calls `/api` on the same origin.

Create the tables once from PowerShell after `server/.env` contains the Supabase URLs:

```powershell
cd "C:\Users\Priyansh\Documents\genesis\volterisk\server"
npm install
npm run db:push:supabase
```

Copy both URLs from the Supabase Connect dialog into `server/.env`. `DIRECT_URL` is the session pooler (port 5432). `DATABASE_URL` may be the transaction pooler (port 6543); on Vercel the server switches that to port 5432, because game writes use transactions and port 6543 never finishes them. URL-encode the password (`@` becomes `%40`). Close that terminal when the push finishes.

Vercel project: root directory `volterisk`. Framework preset Other (`vercel.json` sets `"framework": null`). Leave Install Command, Build Command, and Output Directory overrides off so `vercel.json` is used. Environment variables `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` (not `iron-hour-local-dev`), for Production and Preview. Copy them from `server/.env`. Do not set `VITE_API_URL`. Set the variables before the first deploy, because the build reads them. Open `https://YOUR-PROJECT.vercel.app/api/health` and expect `{"ok":true}`, then register on that same origin.
