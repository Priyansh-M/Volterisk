UPDATE "Vault" AS v
SET balance = v.balance + 1442236
FROM "User" AS u
WHERE v."userId" = u.id
  AND u."usernameKey" = 'lynx'
  AND u."isBot" = false
RETURNING u.username, v.balance;
