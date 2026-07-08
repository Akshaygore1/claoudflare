import { Database } from "bun:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "../../..");
const dbDir = join(rootDir, ".alchemy/miniflare/v3/d1/miniflare-D1DatabaseObject");
const migrationsDir = join(rootDir, "packages/db/src/migrations");

if (!existsSync(dbDir) || !existsSync(migrationsDir)) {
  process.exit(0);
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrationFiles.length !== 1) {
  process.exit(0);
}

const [initialMigration] = migrationFiles;
const sqliteFiles = readdirSync(dbDir).filter(
  (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
);

for (const sqliteFile of sqliteFiles) {
  const db = new Database(join(dbDir, sqliteFile));

  try {
    const migrationsTable = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
      .get();

    if (!migrationsTable) {
      continue;
    }

    const trackedMigrationCount = db.query("SELECT COUNT(*) as count FROM d1_migrations").get() as {
      count: number;
    };

    if (trackedMigrationCount.count > 0) {
      continue;
    }

    const appTables = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA', 'd1_migrations')",
      )
      .all() as Array<{ name: string }>;

    if (appTables.length === 0) {
      continue;
    }

    db.query("INSERT INTO d1_migrations (name, type) VALUES (?, ?)").run(
      initialMigration,
      "migration",
    );

    console.log(`Repaired local D1 migration state in ${sqliteFile}.`);
  } finally {
    db.close();
  }
}
