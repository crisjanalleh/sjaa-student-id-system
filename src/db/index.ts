import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const parsedUrl = new URL(databaseUrl);
if (parsedUrl.protocol !== "mysql:") {
  throw new Error("DATABASE_URL must use the mysql:// protocol");
}

const globalForDb = globalThis as typeof globalThis & {
  __sjaaMariaDbPool?: ReturnType<typeof createPool>;
};

export const pool =
  globalForDb.__sjaaMariaDbPool ??
  createPool({
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: decodeURIComponent(parsedUrl.pathname.slice(1)),
    timezone: "Z",
    waitForConnections: true,
    connectionLimit: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sjaaMariaDbPool = pool;
}

export const db = drizzle(pool);
