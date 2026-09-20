const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const storageDirectory = path.join(__dirname, "..", "storage");

if (!fs.existsSync(storageDirectory)) {
  fs.mkdirSync(storageDirectory, { recursive: true });
}

const databasePath = path.join(storageDirectory, "insera-bot.db");

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS bot_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id TEXT NOT NULL UNIQUE,
    telegram_username TEXT,
    employee_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    work_unit TEXT NOT NULL,
    phone_number TEXT,
    location_latitude REAL,
    location_longitude REAL,
    location_received_at TEXT,
    role TEXT NOT NULL DEFAULT 'USER',
    is_active INTEGER NOT NULL DEFAULT 1,
    registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wo_number TEXT NOT NULL UNIQUE,
    location_code TEXT NOT NULL,
    location_name TEXT NOT NULL,
    status TEXT,
    description TEXT,
    owner_group TEXT,
    work_zone TEXT,
    product_name TEXT,
    product_type TEXT,
    crm_order_type TEXT,
    created_at TEXT,
    modified_at TEXT,
    status_date TEXT,
    schedstart TEXT,
    booking_date TEXT,
    synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_work_orders_location
  ON work_orders(location_code);

  CREATE INDEX IF NOT EXISTS idx_work_orders_work_zone
  ON work_orders(work_zone);

  CREATE INDEX IF NOT EXISTS idx_work_orders_created_at
  ON work_orders(created_at);

  CREATE TABLE IF NOT EXISTS sync_status (
    sync_key TEXT PRIMARY KEY,
    last_success_at TEXT,
    last_attempt_at TEXT,
    last_error TEXT
  );
`);

const workOrderColumns = db
  .prepare("PRAGMA table_info(work_orders)")
  .all()
  .map((column) => column.name);

if (!workOrderColumns.includes("crm_order_type")) {
  db.exec(
    "ALTER TABLE work_orders ADD COLUMN crm_order_type TEXT"
  );
}

module.exports = { db };