import { createClient } from "@libsql/client";

const target = process.env.DATABASE_TARGET?.toLowerCase();
const url = target === "local"
  ? "file:local.db"
  : target === "turso"
    ? process.env.TURSO_DATABASE_URL
    : !process.env.TURSO_DATABASE_URL
      ? "file:local.db"
      : undefined;

if (!url) {
  throw new Error("Set DATABASE_TARGET=local or DATABASE_TARGET=turso before using the database");
}

export const db = createClient({
  url,
  authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN,
});
