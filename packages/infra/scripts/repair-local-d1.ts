import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "../../..");
const dbDir = join(rootDir, ".alchemy/miniflare/v3/d1/miniflare-D1DatabaseObject");
const migrationsDir = join(rootDir, "packages/db/src/migrations");
const infraStateDir = join(rootDir, "packages/infra/.alchemy");

function repairLocalAlchemySecrets() {
  if (!existsSync(infraStateDir)) {
    return;
  }

  const stageDirs = readdirSync(infraStateDir, { recursive: true }).filter((entry) =>
    entry.endsWith("/server.json"),
  );

  for (const relativePath of stageDirs) {
    const filePath = join(infraStateDir, relativePath);
    const state = JSON.parse(readFileSync(filePath, "utf8")) as {
      output?: { bindings?: Record<string, unknown> };
      props?: { bindings?: Record<string, unknown> };
    };

    let changed = false;

    for (const bindings of [state.output?.bindings, state.props?.bindings]) {
      const secret = bindings?.BETTER_AUTH_SECRET;

      if (secret && typeof secret === "object" && "@secret" in secret) {
        delete bindings.BETTER_AUTH_SECRET;
        changed = true;
      }
    }

    if (!changed) {
      continue;
    }

    writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
    console.log(`Repaired stale Alchemy secret state in ${relativePath}.`);
  }
}

repairLocalAlchemySecrets();

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
