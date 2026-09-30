import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function writePostgresSchema() {
  const sourcePath = path.join(serverRoot, "prisma", "schema.prisma");
  const source = fs.readFileSync(sourcePath, "utf8");

  const sqliteDatasource = `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;

  const postgresDatasource = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

  const sqliteGenerator = `generator client {
  provider = "prisma-client-js"
}`;

  const postgresGenerator = `generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}`;

  if (!source.includes(sqliteDatasource) || !source.includes(sqliteGenerator)) {
    throw new Error("schema.prisma no longer matches the sqlite blocks this script rewrites.");
  }

  const postgres = source.replace(sqliteGenerator, postgresGenerator).replace(sqliteDatasource, postgresDatasource);
  if (postgres.includes('provider = "sqlite"') || !postgres.includes('provider  = "postgresql"')) {
    throw new Error("Postgres schema rewrite did not apply.");
  }

  const outPath = path.join(serverRoot, "prisma", "schema.postgres.prisma");
  fs.writeFileSync(outPath, postgres);
  console.log(`Wrote ${outPath}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) writePostgresSchema();
