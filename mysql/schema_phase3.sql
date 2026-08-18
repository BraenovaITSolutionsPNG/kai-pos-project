-- ============================================================
-- KAI POS — Phase 3: Subscriptions, payments, notifications,
-- landing page content (SaaS platform admin)
-- Run in phpMyAdmin or: mysql -u root < mysql/schema_phase3.sql
-- ============================================================

USE kai_pos;

-- One current subscription per business (billing contract).
CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) PRIMARY KEY,
  business_id CHAR(36) NOT NULL UNIQUE,
  plan ENUM('starter','business','professional') NOT NULL DEFAULT 'starter',
  billing_cycle ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'active',
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  reminder_sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_business FOREIGN KEY (business_id)
    REFERENCES businesses (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Payments recorded against a subscription, awaiting admin approval.
CREATE TABLE IF NOT EXISTS subscription_payments (
  id CHAR(36) PRIMARY KEY,
  subscription_id CHAR(36) NOT NULL,
  business_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('cash','eftpos','bank_transfer','online_bank_transfer','mobile_banking','bsp','kina_bank','anz','westpac','other')
    NOT NULL DEFAULT 'bank_transfer',
  bank VARCHAR(50) NULL,
  reference VARCHAR(255) NULL,
  proof_url VARCHAR(500) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by CHAR(36) NULL,
  approved_at DATETIME NULL,
  CONSTRAINT fk_sp_subscription FOREIGN KEY (subscription_id)
    REFERENCES subscriptions (id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_business FOREIGN KEY (business_id)
    REFERENCES businesses (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- In-app notifications (e.g. platform admin reminders to owners).
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  link VARCHAR(500) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Landing page content managed by the platform admin (key/value JSON).
CREATE TABLE IF NOT EXISTS site_content (
  id VARCHAR(100) PRIMARY KEY,
  value JSON NOT NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sp_status ON subscription_payments (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions (current_period_end);