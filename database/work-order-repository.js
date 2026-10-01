const { db } = require("./connection");

const SYNC_INTERVAL_SETTING_KEY =
  "work_order_sync_interval_minutes";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toNullableText(value) {
  const text = normalizeText(value);

  return text || null;
}

function ensureAppSettingsTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

function getSetting(settingKey) {
  ensureAppSettingsTable();

  const row = db
    .prepare(`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = ?
    `)
    .get(normalizeText(settingKey));

  return row?.setting_value || null;
}

function saveSetting(settingKey, settingValue) {
  ensureAppSettingsTable();

  const updatedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO app_settings (
      setting_key,
      setting_value,
      updated_at
    )
    VALUES (
      @settingKey,
      @settingValue,
      @updatedAt
    )
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at
  `).run({
    settingKey: normalizeText(settingKey),
    settingValue: normalizeText(settingValue),
    updatedAt
  });
}

function getSavedWorkOrderSyncInterval() {
  const value = Number(
    getSetting(SYNC_INTERVAL_SETTING_KEY)
  );

  return Number.isFinite(value) && value > 0
    ? value
    : null;
}

function saveWorkOrderSyncInterval(intervalMinutes) {
  saveSetting(
    SYNC_INTERVAL_SETTING_KEY,
    Number(intervalMinutes)
  );
}

function mapDatabaseRowToWorkOrder(row) {
  if (!row) {
    return null;
  }

  return {
    woNumber: row.wo_number,
    locationCode: row.location_code,
    locationName: row.location_name,

    createdAt: row.created_at,
    modifiedAt: row.modified_at,
    scOrderNumber: row.sc_order_number,
    ossOrderId: row.oss_order_id,
    serviceNumber: row.service_number,

    status: row.status,
    description: row.description,
    ownerGroup: row.owner_group,
    productName: row.product_name,
    crmOrderType: row.crm_order_type,

    workZone: row.work_zone,
    area: row.area_tif,
    regional: row.regional_tif,
    district: row.district_tif,
    regionSiteId: row.region_site_id,

    customerName: row.customer_name,
    address: row.service_address,
    witel: row.witel,

    statusDate: row.status_date,
    schedstart: row.schedstart,
    contactNumber: row.contact_number,

    measurement: row.measurement,
    measurementDate: row.measurement_date,
    measurementResult: row.measurement_result,

    woClass: row.wo_class,
    contractNumber: row.contract_number,
    productType: row.product_type,
    bookingDate: row.booking_date,

    channelIdTsel: row.channel_id_tsel,
    orderIdTsel: row.order_id_tsel,

    syncedAt: row.synced_at
  };
}

function prepareWorkOrder(workOrder, syncedAt) {
  return {
    woNumber: normalizeText(workOrder.woNumber),

    locationCode:
      toNullableText(workOrder.locationCode) || "UNKNOWN",

    locationName:
      toNullableText(workOrder.locationName) ||
      "Tidak diketahui",

    createdAt: toNullableText(workOrder.createdAt),
    modifiedAt: toNullableText(workOrder.modifiedAt),
    scOrderNumber: toNullableText(
      workOrder.scOrderNumber
    ),
    ossOrderId: toNullableText(workOrder.ossOrderId),
    serviceNumber: toNullableText(
      workOrder.serviceNumber
    ),

    status: toNullableText(workOrder.status),
    description: toNullableText(workOrder.description),
    ownerGroup: toNullableText(workOrder.ownerGroup),
    productName: toNullableText(workOrder.productName),
    crmOrderType: toNullableText(
      workOrder.crmOrderType
    ),

    workZone: toNullableText(workOrder.workZone),
    area: toNullableText(workOrder.area),
    regional: toNullableText(workOrder.regional),
    district: toNullableText(workOrder.district),
    regionSiteId: toNullableText(
      workOrder.regionSiteId
    ),

    customerName: toNullableText(
      workOrder.customerName
    ),
    address: toNullableText(workOrder.address),
    witel: toNullableText(workOrder.witel),

    statusDate: toNullableText(workOrder.statusDate),
    schedstart: toNullableText(workOrder.schedstart),
    contactNumber: toNullableText(
      workOrder.contactNumber
    ),

    measurement: toNullableText(workOrder.measurement),
    measurementDate: toNullableText(
      workOrder.measurementDate
    ),
    measurementResult: toNullableText(
      workOrder.measurementResult
    ),

    woClass: toNullableText(workOrder.woClass),
    contractNumber: toNullableText(
      workOrder.contractNumber
    ),
    productType: toNullableText(workOrder.productType),
    bookingDate: toNullableText(workOrder.bookingDate),

    channelIdTsel: toNullableText(
      workOrder.channelIdTsel
    ),
    orderIdTsel: toNullableText(
      workOrder.orderIdTsel
    ),

    syncedAt
  };
}

function removeDuplicateWorkOrders(workOrders) {
  const uniqueWorkOrders = new Map();

  for (const workOrder of workOrders) {
    uniqueWorkOrders.set(workOrder.woNumber, workOrder);
  }

  return [...uniqueWorkOrders.values()];
}

function saveWorkOrders(
  workOrders,
  syncedAt = new Date().toISOString()
) {
  const normalizedWorkOrders = (workOrders || [])
    .map((workOrder) => prepareWorkOrder(workOrder, syncedAt))
    .filter((workOrder) => workOrder.woNumber);

  const uniqueWorkOrders = removeDuplicateWorkOrders(
    normalizedWorkOrders
  );

  if (uniqueWorkOrders.length === 0) {
    throw new Error(
      "Penyimpanan dibatalkan: tidak ada Work Order valid dari hasil sinkronisasi."
    );
  }

  const duplicateCount =
    normalizedWorkOrders.length - uniqueWorkOrders.length;

  if (duplicateCount > 0) {
    console.warn(
      `[work-order-repository] ${duplicateCount} WO duplikat dari API diabaikan.`
    );
  }

  const insertWorkOrder = db.prepare(`
    INSERT INTO work_orders (
      wo_number,
      location_code,
      location_name,

      created_at,
      modified_at,
      sc_order_number,
      oss_order_id,
      service_number,

      status,
      description,
      owner_group,
      product_name,
      crm_order_type,

      work_zone,
      area_tif,
      regional_tif,
      district_tif,
      region_site_id,

      customer_name,
      service_address,
      witel,

      status_date,
      schedstart,
      contact_number,

      measurement,
      measurement_date,
      measurement_result,

      wo_class,
      contract_number,
      product_type,
      booking_date,

      channel_id_tsel,
      order_id_tsel,

      synced_at
    )
    VALUES (
      @woNumber,
      @locationCode,
      @locationName,

      @createdAt,
      @modifiedAt,
      @scOrderNumber,
      @ossOrderId,
      @serviceNumber,

      @status,
      @description,
      @ownerGroup,
      @productName,
      @crmOrderType,

      @workZone,
      @area,
      @regional,
      @district,
      @regionSiteId,

      @customerName,
      @address,
      @witel,

      @statusDate,
      @schedstart,
      @contactNumber,

      @measurement,
      @measurementDate,
      @measurementResult,

      @woClass,
      @contractNumber,
      @productType,
      @bookingDate,

      @channelIdTsel,
      @orderIdTsel,

      @syncedAt
    )
  `);

  const replaceAllWorkOrders = db.transaction(() => {
    db.prepare("DELETE FROM work_orders").run();

    for (const workOrder of uniqueWorkOrders) {
      insertWorkOrder.run(workOrder);
    }
  });

  replaceAllWorkOrders();

  return {
    saved: uniqueWorkOrders.length,
    duplicatesIgnored: duplicateCount,
    syncedAt
  };
}

function getAllSavedWorkOrders() {
  return db
    .prepare(`
      SELECT *
      FROM work_orders
      ORDER BY
        datetime(created_at) DESC,
        wo_number DESC
    `)
    .all()
    .map(mapDatabaseRowToWorkOrder);
}

function findSavedWorkOrderByNumber(woNumber) {
  const row = db
    .prepare(`
      SELECT *
      FROM work_orders
      WHERE upper(wo_number) = upper(?)
    `)
    .get(normalizeText(woNumber));

  return mapDatabaseRowToWorkOrder(row);
}

function getSavedWorkOrdersByWorkZones(workZones) {
  const normalizedWorkZones = (workZones || [])
    .map((workZone) => normalizeText(workZone).toUpperCase())
    .filter(Boolean);

  if (normalizedWorkZones.length === 0) {
    return [];
  }

  const placeholders = normalizedWorkZones
    .map(() => "?")
    .join(", ");

  return db
    .prepare(`
      SELECT *
      FROM work_orders
      WHERE upper(work_zone) IN (${placeholders})
      ORDER BY
        datetime(created_at) DESC,
        wo_number DESC
    `)
    .all(...normalizedWorkZones)
    .map(mapDatabaseRowToWorkOrder);
}

function getLatestSavedSyncAt() {
  const result = db
    .prepare(`
      SELECT MAX(synced_at) AS last_synced_at
      FROM work_orders
    `)
    .get();

  return result?.last_synced_at || null;
}

function saveSyncSuccess(syncedAt = new Date().toISOString()) {
  db.prepare(`
    INSERT INTO sync_status (
      sync_key,
      last_success_at,
      last_attempt_at,
      last_error
    )
    VALUES (
      'work_orders',
      @syncedAt,
      @syncedAt,
      NULL
    )
    ON CONFLICT(sync_key) DO UPDATE SET
      last_success_at = excluded.last_success_at,
      last_attempt_at = excluded.last_attempt_at,
      last_error = NULL
  `).run({ syncedAt });
}

function saveSyncFailure(errorMessage) {
  const attemptedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO sync_status (
      sync_key,
      last_success_at,
      last_attempt_at,
      last_error
    )
    VALUES (
      'work_orders',
      NULL,
      @attemptedAt,
      @errorMessage
    )
    ON CONFLICT(sync_key) DO UPDATE SET
      last_attempt_at = excluded.last_attempt_at,
      last_error = excluded.last_error
  `).run({
    attemptedAt,
    errorMessage: normalizeText(errorMessage)
  });
}

function getWorkOrderSyncStatus() {
  return (
    db
      .prepare(`
        SELECT *
        FROM sync_status
        WHERE sync_key = 'work_orders'
      `)
      .get() || null
  );
}

module.exports = {
  saveWorkOrders,
  getAllSavedWorkOrders,
  findSavedWorkOrderByNumber,
  getSavedWorkOrdersByWorkZones,
  getLatestSavedSyncAt,
  saveSyncSuccess,
  saveSyncFailure,
  getWorkOrderSyncStatus,
  getSavedWorkOrderSyncInterval,
  saveWorkOrderSyncInterval
};