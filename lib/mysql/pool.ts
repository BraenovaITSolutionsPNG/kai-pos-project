import "server-only";

import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as {
  kaiMysqlPool?: mysql.Pool;
};

export function getPool(): mysql.Pool {
  if (!globalForDb.kaiMysqlPool) {
    globalForDb.kaiMysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "root",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? "kai_pos",
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true,
      dateStrings: false,
      timezone: "Z",
    });
  }
  return globalForDb.kaiMysqlPool;
}

export async function query<T = unknown[]>(
  sql: string,
  params: any[] = []
): Promise<T> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T;
}

export async function execute(
  sql: string,
  params: any[] = []
): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, params);
  return result as mysql.ResultSetHeader;
}

export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}