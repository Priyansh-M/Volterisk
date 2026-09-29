# Iron Hour

A browser heist game. You keep cash and a vault. Other players (and seeded night-crew ledgers) can be robbed only while their vault is vulnerable. The server rolls the job. The client never sends weapon level, vault level, chance, or reward.

All game code lives in this folder.

## Auth

Send `Authorization: Bearer <token>` on every route except register and login. Logout bumps a token version, so the old bearer stops working.

## Run (VS Code, PowerShell)

Two terminals, from the repo root.

```powershell
cd "Mafia web\server"
npm install
npx prisma migrate deploy
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

`server/.env` is a local default (`JWT_SECRET=iron-hour-local-dev`, SQLite file `server/data/dev.db`). Change the secret before any shared deploy. No external database.

## Config

Every gameplay number is on `RULES` in `server/src/game/rules.ts`.

| Knob | Default |
| --- | --- |
| `MIN_VAULT_BALANCE` | 10000 |
| `TARGET_PROTECTION_HOURS` | 12 |
| `HEIST_COOLDOWN_HOURS` | 2 |
| `HEIST_REWARD_PERCENT` | 10 (hard max 10) |
| `STARTING_CASH` | 40000 |
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

## Artwork

Original inline SVG only (wordmark wheel and favicon). No downloaded images.

## API

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`

`GET /api/me`, `GET /api/me/vault`, `GET /api/me/weapons`

`GET /api/heists/targets`, `GET /api/heists/preview`, `POST /api/heists`, `GET /api/heists/history`

`POST /api/vault/upgrade`, `POST /api/vault/withdraw`

`POST /api/weapons/buy`, `POST /api/weapons/upgrade`, `POST /api/weapons/equip`

`GET /api/leaderboard`, `GET /api/notifications`

Heist body is only `{ "targetUserId", "weaponId" }`.
