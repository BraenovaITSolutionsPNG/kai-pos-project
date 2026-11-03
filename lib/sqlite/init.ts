import "server-only";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/sqlite/pool";

export function initSqliteDb() {
  const db = getDb();
  const schemaPath = path.join(process.cwd(), "lib", "sqlite", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
}
