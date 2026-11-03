import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "kai-pos.db");

let db: any = null;

export function getDb(): any {
  if (db) return db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Initialize schema
  const schemaPath = path.join(process.cwd(), "lib", "sqlite", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf8");
    db.exec(schema);
  }

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// MySQL-compatible: returns just rows (like MySQL pool)
export async function query<T = unknown[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ affectedRows: number; insertId: number | bigint }> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return { affectedRows: result.changes, insertId: result.lastInsertRowid };
}

// MySQL-compatible transaction
export async function withTransaction<T>(
  fn: (conn: any) => Promise<T>
): Promise<T> {
  const db = getDb();
  const conn = {
    query: async (sql: string, params: unknown[] = []) => {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      return [rows, []];
    },
    execute: async (sql: string, params: unknown[] = []) => {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return [{ affectedRows: result.changes, insertId: result.lastInsertRowid }, []];
    },
  };
  return fn(conn);
}
