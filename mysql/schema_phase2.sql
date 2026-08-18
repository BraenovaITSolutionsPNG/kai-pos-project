-- Phase 2-4 feature tables
-- Inventory, recipes, stock movements, expenses.

-- Inventory ingredients.
CREATE TABLE IF NOT EXISTS ingredients (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'each',
  current_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ingredients_rest_name (restaurant_id, name),
  CONSTRAINT fk_ingredients_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Recipes: which ingredients make each product, and how much.
CREATE TABLE IF NOT EXISTS recipes (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  ingredient_id CHAR(36) NOT NULL,
  quantity_required DECIMAL(12,3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recipe_product_ingredient (product_id, ingredient_id),
  CONSTRAINT fk_recipes_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_recipes_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_recipes_ingredient FOREIGN KEY (ingredient_id)
    REFERENCES ingredients (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Stock movements (restock, sale deduction, adjustment, waste).
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  ingredient_id CHAR(36) NOT NULL,
  type ENUM('restock','sale','adjustment','waste') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reference VARCHAR(255) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invt_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_invt_ingredient FOREIGN KEY (ingredient_id)
    REFERENCES ingredients (id) ON DELETE CASCADE,
  CONSTRAINT fk_invt_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Expenses for cashup / profit reporting.
CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note VARCHAR(500) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_invt_ingredient ON inventory_transactions (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_expenses_rest_created ON expenses (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes (product_id);