import { createClient } from "@libsql/client";
const client = createClient({
  url: "file:../../.alchemy/miniflare/v3/d1/miniflare-D1DatabaseObject/cf6098c5831b2fb5455c754a4673653ffd08e716627810de8bcb1a09dde33acc.sqlite",
});
async function run() {
  const rs = await client.execute({
    sql: "UPDATE user SET role = 'admin', approval_status = 'approved', approved_at = ? WHERE email = 'admin@mail.com'",
    args: [Date.now()],
  });
  console.log(`Updated ${rs.rowsAffected} rows in the local database.`);
}
run();
