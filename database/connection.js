const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const storageDirectory = process.env.SQLITE_DATA_DIR
  ? path.resolve(process.env.SQLITE_DATA_DIR)
  : path.join(__dirname, "..", "storage");

if (!fs.existsSync(storageDirectory)) {
  fs.mkdirSync(storageDirectory, { recursive: true });
}

const databasePath = path.join(
  storageDirectory,
  "insera-bot.db"
);

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

    sc_order_number TEXT,
    oss_order_id TEXT,
    service_number TEXT,
    area_tif TEXT,
    regional_tif TEXT,
    district_tif TEXT,
    region_site_id TEXT,
    customer_name TEXT,
    service_address TEXT,
    witel TEXT,
    contact_number TEXT,
    measurement TEXT,
    measurement_date TEXT,
    measurement_result TEXT,
    wo_class TEXT,
    contract_number TEXT,
    channel_id_tsel TEXT,
    order_id_tsel TEXT,

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

  CREATE TABLE IF NOT EXISTS notification_groups (
    chat_id TEXT PRIMARY KEY,
    chat_title TEXT NOT NULL,
    chat_type TEXT NOT NULL,
    added_by_telegram_id TEXT NOT NULL,
    added_by_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS personal_subscriptions (
    chat_id TEXT PRIMARY KEY,
    telegram_user_id TEXT NOT NULL,
    telegram_username TEXT,
    service_area_code TEXT NOT NULL,
    notification_interval_minutes INTEGER NOT NULL DEFAULT 15,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    last_notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_personal_subscriptions_area
  ON personal_subscriptions(service_area_code);
`);

function getWorkOrderColumnNames() {
  return db
    .prepare("PRAGMA table_info(work_orders)")
    .all()
    .map((column) => column.name);
}

function ensureWorkOrderColumns() {
  const requiredColumns = {
    crm_order_type: "TEXT",
    sc_order_number: "TEXT",
    oss_order_id: "TEXT",
    service_number: "TEXT",
    area_tif: "TEXT",
    regional_tif: "TEXT",
    district_tif: "TEXT",
    region_site_id: "TEXT",
    customer_name: "TEXT",
    service_address: "TEXT",
    witel: "TEXT",
    contact_number: "TEXT",
    measurement: "TEXT",
    measurement_date: "TEXT",
    measurement_result: "TEXT",
    wo_class: "TEXT",
    contract_number: "TEXT",
    channel_id_tsel: "TEXT",
    order_id_tsel: "TEXT"
  };

  const existingColumns = new Set(
    getWorkOrderColumnNames()
  );

  for (const [columnName, columnType] of Object.entries(
    requiredColumns
  )) {
    if (!existingColumns.has(columnName)) {
      db.exec(
        `ALTER TABLE work_orders ADD COLUMN ${columnName} ${columnType}`
      );

      console.log(
        `[database] kolom work_orders ditambahkan: ${columnName}`
      );
    }
  }
}

ensureWorkOrderColumns();

module.exports = { db };