import { createAuth } from "@dubbed-i/auth";
import { env } from "@dubbed-i/env/server";
import type { Context as HonoContext } from "hono";

import { createContextValue } from "./context-value";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await createAuth().api.getSession({
    headers: context.req.raw.headers,
  });

  return createContextValue(session, env.VIDEOS_BUCKET);
}

export type Context = Awaited<ReturnType<typeof createContext>>;
