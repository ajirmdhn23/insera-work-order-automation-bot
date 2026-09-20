const { db } = require("./connection");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function mapDatabaseRowToWorkOrder(row) {
  if (!row) {
    return null;
  }

  return {
    woNumber: row.wo_number,
    locationCode: row.location_code,
    locationName: row.location_name,
    status: row.status,
    description: row.description,
    ownerGroup: row.owner_group,
    workZone: row.work_zone,
    productName: row.product_name,
    productType: row.product_type,
    crmOrderType: row.crm_order_type,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
    statusDate: row.status_date,
    schedstart: row.schedstart,
    bookingDate: row.booking_date,
    syncedAt: row.synced_at
  };
}

function prepareWorkOrder(workOrder, syncedAt) {
  return {
    woNumber: normalizeText(workOrder.woNumber),
    locationCode: toNullableText(workOrder.locationCode) || "UNKNOWN",
    locationName: toNullableText(workOrder.locationName) || "Tidak diketahui",
    status: toNullableText(workOrder.status),
    description: toNullableText(workOrder.description),
    ownerGroup: toNullableText(workOrder.ownerGroup),
    workZone: toNullableText(workOrder.workZone),
    productName: toNullableText(workOrder.productName),
    productType: toNullableText(workOrder.productType),
    crmOrderType: toNullableText(workOrder.crmOrderType),
    createdAt: toNullableText(workOrder.createdAt),
    modifiedAt: toNullableText(workOrder.modifiedAt),
    statusDate: toNullableText(workOrder.statusDate),
    schedstart: toNullableText(workOrder.schedstart),
    bookingDate: toNullableText(workOrder.bookingDate),
    syncedAt
  };
}

function saveWorkOrders(workOrders, syncedAt = new Date().toISOString()) {
  const normalizedWorkOrders = (workOrders || [])
    .map((workOrder) => prepareWorkOrder(workOrder, syncedAt))
    .filter((workOrder) => workOrder.woNumber);

  if (normalizedWorkOrders.length === 0) {
    throw new Error(
      "Penyimpanan dibatalkan: tidak ada Work Order valid dari hasil sinkronisasi."
    );
  }

  const insertWorkOrder = db.prepare(`
    INSERT INTO work_orders (
      wo_number,
      location_code,
      location_name,
      status,
      description,
      owner_group,
      work_zone,
      product_name,
      product_type,
      crm_order_type,
      created_at,
      modified_at,
      status_date,
      schedstart,
      booking_date,
      synced_at
    )
    VALUES (
      @woNumber,
      @locationCode,
      @locationName,
      @status,
      @description,
      @ownerGroup,
      @workZone,
      @productName,
      @productType,
      @crmOrderType,
      @createdAt,
      @modifiedAt,
      @statusDate,
      @schedstart,
      @bookingDate,
      @syncedAt
    )
  `);

  const replaceAllWorkOrders = db.transaction(() => {
    db.prepare("DELETE FROM work_orders").run();

    for (const workOrder of normalizedWorkOrders) {
      insertWorkOrder.run(workOrder);
    }
  });

  replaceAllWorkOrders();

  return {
    saved: normalizedWorkOrders.length,
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
  return db
    .prepare(`
      SELECT *
      FROM sync_status
      WHERE sync_key = 'work_orders'
    `)
    .get() || null;
}

module.exports = {
  saveWorkOrders,
  getAllSavedWorkOrders,
  findSavedWorkOrderByNumber,
  getSavedWorkOrdersByWorkZones,
  getLatestSavedSyncAt,
  saveSyncSuccess,
  saveSyncFailure,
  getWorkOrderSyncStatus
};