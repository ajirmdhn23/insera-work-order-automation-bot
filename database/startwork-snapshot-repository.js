const { db } = require("./connection");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeStatus(value) {
  return normalizeText(value).toUpperCase();
}

function isStartwork(workOrder) {
  return normalizeStatus(workOrder?.status) === "STARTWORK";
}

function ensureStartworkSnapshotTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS startwork_snapshots (
      wo_number TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      work_zone TEXT,
      location_code TEXT,
      location_name TEXT,
      description TEXT,
      owner_group TEXT,
      product_name TEXT,
      product_type TEXT,
      crm_order_type TEXT,
      modified_at TEXT,
      status_date TEXT,
      schedstart TEXT,
      booking_date TEXT,
      snapshot_at TEXT NOT NULL
    )
  `).run();
}

function mapWorkOrderToSnapshot(workOrder, snapshotAt) {
  return {
    woNumber: normalizeText(workOrder.woNumber),
    status: normalizeStatus(workOrder.status),
    workZone: normalizeText(workOrder.workZone) || null,
    locationCode: normalizeText(workOrder.locationCode) || null,
    locationName: normalizeText(workOrder.locationName) || null,
    description: normalizeText(workOrder.description) || null,
    ownerGroup: normalizeText(workOrder.ownerGroup) || null,
    productName: normalizeText(workOrder.productName) || null,
    productType: normalizeText(workOrder.productType) || null,
    crmOrderType: normalizeText(workOrder.crmOrderType) || null,
    modifiedAt: normalizeText(workOrder.modifiedAt) || null,
    statusDate: normalizeText(workOrder.statusDate) || null,
    schedstart: normalizeText(workOrder.schedstart) || null,
    bookingDate: normalizeText(workOrder.bookingDate) || null,
    snapshotAt
  };
}

function removeDuplicateSnapshots(snapshots) {
  const uniqueSnapshots = new Map();

  for (const snapshot of snapshots) {
    uniqueSnapshots.set(snapshot.woNumber, snapshot);
  }

  return [...uniqueSnapshots.values()];
}

function buildStartworkSnapshotList(
  workOrders,
  snapshotAt = new Date().toISOString()
) {
  const mappedSnapshots = (workOrders || [])
    .filter(isStartwork)
    .map((workOrder) => mapWorkOrderToSnapshot(workOrder, snapshotAt))
    .filter((workOrder) => workOrder.woNumber);

  const uniqueSnapshots = removeDuplicateSnapshots(mappedSnapshots);
  const duplicateCount = mappedSnapshots.length - uniqueSnapshots.length;

  if (duplicateCount > 0) {
    console.warn(
      `[startwork-snapshot] ${duplicateCount} STARTWORK duplikat dari API diabaikan.`
    );
  }

  return uniqueSnapshots;
}

function getStartworkSnapshotMap() {
  ensureStartworkSnapshotTable();

  const rows = db
    .prepare(`
      SELECT *
      FROM startwork_snapshots
    `)
    .all();

  return new Map(
    rows.map((row) => [
      row.wo_number,
      {
        woNumber: row.wo_number,
        status: row.status,
        workZone: row.work_zone,
        locationCode: row.location_code,
        locationName: row.location_name,
        description: row.description,
        ownerGroup: row.owner_group,
        productName: row.product_name,
        productType: row.product_type,
        crmOrderType: row.crm_order_type,
        modifiedAt: row.modified_at,
        statusDate: row.status_date,
        schedstart: row.schedstart,
        bookingDate: row.booking_date,
        snapshotAt: row.snapshot_at
      }
    ])
  );
}

function buildComparableSnapshot(snapshot) {
  return JSON.stringify({
    status: snapshot.status,
    workZone: snapshot.workZone,
    locationCode: snapshot.locationCode,
    locationName: snapshot.locationName,
    description: snapshot.description,
    ownerGroup: snapshot.ownerGroup,
    productName: snapshot.productName,
    productType: snapshot.productType,
    crmOrderType: snapshot.crmOrderType,
    modifiedAt: snapshot.modifiedAt,
    statusDate: snapshot.statusDate,
    schedstart: snapshot.schedstart,
    bookingDate: snapshot.bookingDate
  });
}

function detectStartworkChanges(
  workOrders,
  snapshotAt = new Date().toISOString()
) {
  ensureStartworkSnapshotTable();

  const previousSnapshots = getStartworkSnapshotMap();

  const currentStartwork = buildStartworkSnapshotList(
    workOrders,
    snapshotAt
  );

  const currentSnapshotMap = new Map(
    currentStartwork.map((workOrder) => [
      workOrder.woNumber,
      workOrder
    ])
  );

  const changes = {
    isFirstSnapshot: previousSnapshots.size === 0,
    newStartwork: [],
    updatedStartwork: [],
    endedStartwork: []
  };

  for (const currentSnapshot of currentStartwork) {
    const previousSnapshot = previousSnapshots.get(
      currentSnapshot.woNumber
    );

    if (!previousSnapshot) {
      changes.newStartwork.push(currentSnapshot);
      continue;
    }

    if (
      buildComparableSnapshot(currentSnapshot) !==
      buildComparableSnapshot(previousSnapshot)
    ) {
      changes.updatedStartwork.push({
        previous: previousSnapshot,
        current: currentSnapshot
      });
    }
  }

  for (const previousSnapshot of previousSnapshots.values()) {
    if (!currentSnapshotMap.has(previousSnapshot.woNumber)) {
      changes.endedStartwork.push(previousSnapshot);
    }
  }

  return changes;
}

function replaceStartworkSnapshot(
  workOrders,
  snapshotAt = new Date().toISOString()
) {
  ensureStartworkSnapshotTable();

  const currentStartwork = buildStartworkSnapshotList(
    workOrders,
    snapshotAt
  );

  const insertSnapshot = db.prepare(`
    INSERT INTO startwork_snapshots (
      wo_number,
      status,
      work_zone,
      location_code,
      location_name,
      description,
      owner_group,
      product_name,
      product_type,
      crm_order_type,
      modified_at,
      status_date,
      schedstart,
      booking_date,
      snapshot_at
    )
    VALUES (
      @woNumber,
      @status,
      @workZone,
      @locationCode,
      @locationName,
      @description,
      @ownerGroup,
      @productName,
      @productType,
      @crmOrderType,
      @modifiedAt,
      @statusDate,
      @schedstart,
      @bookingDate,
      @snapshotAt
    )
  `);

  const replaceSnapshot = db.transaction(() => {
    db.prepare("DELETE FROM startwork_snapshots").run();

    for (const snapshot of currentStartwork) {
      insertSnapshot.run(snapshot);
    }
  });

  replaceSnapshot();

  return {
    saved: currentStartwork.length,
    snapshotAt
  };
}

module.exports = {
  detectStartworkChanges,
  replaceStartworkSnapshot
};