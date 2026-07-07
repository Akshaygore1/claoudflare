import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "../../.alchemy/miniflare/v3/d1/miniflare-D1DatabaseObject/cf6098c5831b2fb5455c754a4673653ffd08e716627810de8bcb1a09dde33acc.sqlite",
  },
});
