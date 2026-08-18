// Seed a default owner account + business + menu so the app is usable immediately.
// Run: node mysql/seed.mjs
import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "crypto";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "kai_pos",
});

const uuid = () => crypto.randomUUID();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    const email = (process.env.SEED_EMAIL ?? "owner@kaipos.pg").toLowerCase();
    const password = process.env.SEED_PASSWORD ?? "kaipos123";
    const fullName = process.env.SEED_NAME ?? "KAI Owner";
    const businessName = process.env.SEED_BUSINESS ?? "KAI Demo Café";

    const [existing] = await conn.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existing.length > 0) {
      console.log(`User ${email} already exists. Done.`);
      return;
    }

    const userId = uuid();
    const businessId = uuid();
    const restaurantId = uuid();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO users (id, email, full_name, phone, password_hash, created_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [userId, email, fullName, hashPassword(password), now]
    );
    await conn.query(
      `INSERT INTO businesses (id, name, owner_id, plan, created_at) VALUES (?, ?, ?, 'starter', ?)`,
      [businessId, businessName, userId, now]
    );
    await conn.query(
      `INSERT INTO restaurants (id, business_id, name, address, currency, tax_rate, created_at)
       VALUES (?, ?, ?, '', 'PGK', 0, ?)`,
      [restaurantId, businessId, businessName, now]
    );
    await conn.query(
      `INSERT INTO staff (id, restaurant_id, user_id, role, is_active, created_at)
       VALUES (?, ?, ?, 'owner', 1, ?)`,
      [uuid(), restaurantId, userId, now]
    );

    const catIds = { food: uuid(), drinks: uuid(), snacks: uuid(), desserts: uuid() };
    const cats = [
      [catIds.food, "Food", 1],
      [catIds.drinks, "Drinks", 2],
      [catIds.snacks, "Snacks", 3],
      [catIds.desserts, "Desserts", 4],
    ];
    for (const [id, name, sort] of cats) {
      await conn.query(
        `INSERT INTO categories (id, restaurant_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
        [id, restaurantId, name, sort, now]
      );
    }

    const products = [
      [catIds.food, "Chicken Fried Rice", 25.0, 1],
      [catIds.food, "Fish & Chips", 32.0, 2],
      [catIds.food, "Chicken Steak", 38.0, 3],
      [catIds.food, "BBQ Pork Ribs", 42.0, 4],
      [catIds.drinks, "Coca-Cola (330ml)", 5.5, 1],
      [catIds.drinks, "Fresh Water (1.5L)", 5.0, 2],
      [catIds.drinks, "Mango Juice", 8.0, 3],
      [catIds.snacks, "Crisps", 4.0, 1],
      [catIds.snacks, "Chicken Roll", 12.0, 2],
      [catIds.desserts, "Ice Cream Sundae", 8.0, 1],
    ];
    for (const [catId, name, price, sort] of products) {
      await conn.query(
        `INSERT INTO products (id, restaurant_id, category_id, name, price, is_active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [uuid(), restaurantId, catId, name, price, sort, now]
      );
    }

    await conn.commit();
    console.log(`Seeded ${email} / ${password} (${businessName})`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});