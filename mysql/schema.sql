-- ============================================================
-- KAI POS — Phase 1 Schema (MySQL / MariaDB)
-- Run this in phpMyAdmin or: mysql -u root < mysql/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS kai_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kai_pos;

-- Businesses (SaaS subscription holder / tenant).
CREATE TABLE IF NOT EXISTS businesses (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id CHAR(36) NULL,
  plan ENUM('starter','business','professional') NOT NULL DEFAULT 'starter',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Physical restaurant locations under a business.
CREATE TABLE IF NOT EXISTS restaurants (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'PGK',
  logo_url VARCHAR(1000) NULL,
  tax_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurants_business FOREIGN KEY (business_id)
    REFERENCES businesses (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- App users (auth handled by the app, not MySQL's user table).
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  full_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Staff link a user to a restaurant with a role.
CREATE TABLE IF NOT EXISTS staff (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner','manager','cashier','kitchen') NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_rest_user (restaurant_id, user_id),
  CONSTRAINT fk_staff_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Product categories per restaurant.
CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_rest_name (restaurant_id, name),
  CONSTRAINT fk_categories_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Menu products per restaurant.
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  category_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(1000) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Table / floor-plan (Phase 2).
CREATE TABLE IF NOT EXISTS tables (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  label VARCHAR(50) NOT NULL,
  status ENUM('available','occupied','reserved') NOT NULL DEFAULT 'available',
  capacity INT NOT NULL DEFAULT 4,
  position_x DECIMAL(10,2) NOT NULL DEFAULT 0,
  position_y DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tables_rest_label (restaurant_id, label),
  CONSTRAINT fk_tables_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Sales orders.
CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  table_id CHAR(36) NULL,
  order_number BIGINT NOT NULL,
  status ENUM('open','sent_to_kitchen','preparing','ready','served','paid','cancelled')
    NOT NULL DEFAULT 'paid',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_rest_number (restaurant_id, order_number),
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id)
    REFERENCES tables (id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Line items for an order.
CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  notes VARCHAR(500) NULL,
  status ENUM('new','preparing','ready') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Payments against an order.
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  method ENUM('cash','eftpos','bank_transfer','bsp','kina_bank','anz','westpac','other')
    NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- App sessions (cookie-backed auth).
CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Order counters per restaurant.
CREATE TABLE IF NOT EXISTS order_counters (
  restaurant_id CHAR(36) PRIMARY KEY,
  last_number BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_order_counters_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_orders_rest_created ON orders (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_rest_status ON orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_rest ON products (restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_categories_rest ON categories (restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);