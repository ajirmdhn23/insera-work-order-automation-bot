const {
  fetchWorkOrdersFromInsera
} = require("./insera-api-service");

const {
  getAuthenticatedSession
} = require("./insera-auth-service");

const {
  saveWorkOrders,
  getAllSavedWorkOrders,
  findSavedWorkOrderByNumber,
  getSavedWorkOrdersByWorkZones,
  getLatestSavedSyncAt,
  saveSyncSuccess,
  saveSyncFailure
} = require("../database/work-order-repository");
const serviceAreas = {
  SA_BTU: {
    name: "SA Batu",
    workZones: ["BTU", "NTG", "KPO"]
  },
  SA_BLB: {
    name: "SA Blimbing",
    workZones: ["BLB"]
  },
  SA_KLJ: {
    name: "SA Klojen",
    workZones: ["KLJ"]
  },
  SA_KEP: {
    name: "SA Kepanjen",
    workZones: ["KEP", "PGK", "SBP", "GKW", "DNO", "GDG"]
  },
  SA_TUR: {
    name: "SA Turen",
    workZones: ["DPT", "SBM", "APG", "TUR", "BNR", "GDI"]
  },
  SA_MLG: {
    name: "SA Malang",
    workZones: ["MLG", "SWJ", "BRG"]
  },
  SA_SWJ: {
    name: "SA Sawojajar",
    workZones: ["PKS", "TMP", "LWG", "SGS"]
  },
  SA_BLR: {
    name: "SA Blitar",
    workZones: ["BLR", "SNT", "PAN", "BNU", "KBN", "LDY", "WGI"]
  },
  SA_TUL: {
    name: "SA Tulungagung",
    workZones: ["CAT", "KWR", "NGU", "TUL"]
  }
};

let cachedWorkOrders = [];
let lastSyncedAt = null;
let isSyncing = false;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getAllAllowedWorkZones() {
  return [
    ...new Set(
      Object.values(serviceAreas)
        .flatMap((serviceArea) => serviceArea.workZones)
        .map(normalizeText)
        .filter(Boolean)
    )
  ];
}

function isAllowedWorkOrder(workOrder) {
  return (
    Boolean(workOrder?.woNumber) &&
    getAllAllowedWorkZones().includes(
      normalizeText(workOrder.workZone)
    )
  );
}

function getServiceAreaByCode(serviceAreaCode) {
  return serviceAreas[serviceAreaCode] || null;
}

function getServiceAreaCodes() {
  return Object.keys(serviceAreas);
}

function loadCachedWorkOrdersFromDatabase() {
  const savedWorkOrders = getAllSavedWorkOrders();

  cachedWorkOrders = Array.isArray(savedWorkOrders)
    ? savedWorkOrders
    : [];

  lastSyncedAt = getLatestSavedSyncAt() || null;

  console.log("[work-order-cache] data SQLite dimuat", {
    loaded: cachedWorkOrders.length,
    lastSyncedAt
  });

  return cachedWorkOrders;
}

function getAllWorkOrders() {
  if (cachedWorkOrders.length > 0) {
    return cachedWorkOrders;
  }

  return loadCachedWorkOrdersFromDatabase();
}

function getDataSource() {
  return getAllWorkOrders();
}

function getAllWorkOrdersSafe() {
  const workOrders = getDataSource();

  return Array.isArray(workOrders) ? workOrders : [];
}

function getWorkOrdersByServiceArea(serviceAreaCode) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  if (!serviceArea) {
    return [];
  }

  const workZones = serviceArea.workZones.map(normalizeText);

  return getAllWorkOrdersSafe()
    .filter((workOrder) => {
      return (
        workZones.includes(normalizeText(workOrder.workZone)) &&
        normalizeText(workOrder.status) === "STARTWORK"
      );
    })
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
    );
}

function getSavedWorkOrdersByServiceArea(serviceAreaCode) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  if (!serviceArea) {
    return [];
  }

  try {
    const workOrders = getSavedWorkOrdersByWorkZones(
      serviceArea.workZones
    );

    return Array.isArray(workOrders)
      ? workOrders.filter(
          (workOrder) =>
            normalizeText(workOrder.status) === "STARTWORK"
        )
      : [];
  } catch (error) {
    console.warn(
      "[work-order-service] gagal mengambil data berdasarkan Work Zone:",
      error.message
    );

    return getWorkOrdersByServiceArea(serviceAreaCode);
  }
}

function findWorkOrderByNumber(workOrderNumber) {
  const normalizedNumber = normalizeText(workOrderNumber);

  if (!normalizedNumber) {
    return null;
  }

  const cachedResult = getAllWorkOrders().find(
    (workOrder) =>
      normalizeText(workOrder.woNumber) === normalizedNumber
  );

  return (
    cachedResult ||
    findSavedWorkOrderByNumber(normalizedNumber)
  );
}

function isWorkOrderInServiceArea(workOrder, serviceAreaCode) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  if (!workOrder || !serviceArea) {
    return false;
  }

  return serviceArea.workZones
    .map(normalizeText)
    .includes(normalizeText(workOrder.workZone));
}

function getLastSyncedAt(workOrders = []) {
  const fromWorkOrder = Array.isArray(workOrders)
    ? workOrders.find((workOrder) => workOrder?.syncedAt)
        ?.syncedAt
    : null;

  return (
    fromWorkOrder ||
    lastSyncedAt ||
    getLatestSavedSyncAt() ||
    null
  );
}

async function fetchAllPagesForWorkZone(workZone, pageSize = 100) {
  const normalizedWorkZone = normalizeText(workZone);
  const allWorkOrders = [];

  let page = 1;
  let totalPages = null;

  while (true) {
    console.log("[work-order-sync] mengambil data Work Zone", {
      workZone: normalizedWorkZone,
      page
    });

    const result = await fetchWorkOrdersFromInsera({
      page,
      pageSize,
      workZone: normalizedWorkZone
    });

    const pageWorkOrders = Array.isArray(result.workOrders)
      ? result.workOrders
      : [];

    allWorkOrders.push(...pageWorkOrders);

    console.log("[work-order-sync] halaman diterima", {
      workZone: normalizedWorkZone,
      page,
      records: pageWorkOrders.length,
      recordsFiltered: result.recordsFiltered,
      totalPages: result.totalPages
    });

    if (Number(result.totalPages) > 0) {
      totalPages = Number(result.totalPages);
    }

    if (
      (totalPages && page >= totalPages) ||
      pageWorkOrders.length === 0 ||
      pageWorkOrders.length < pageSize
    ) {
      break;
    }

    page += 1;

    if (page > 100) {
      throw new Error(
        `Pagination ${normalizedWorkZone} melewati batas 100 halaman.`
      );
    }
  }

  return allWorkOrders;
}

async function syncWorkOrdersFromInsera() {
  if (isSyncing) {
    console.log(
      "[work-order-sync] sync dilewati karena proses sebelumnya masih berjalan."
    );

    return {
      skipped: true,
      totalFetched: 0,
      totalSaved: 0,
      lastSyncedAt
    };
  }

  isSyncing = true;

  try {
    console.log(
      "[work-order-sync] memverifikasi satu sesi WFM untuk seluruh Service Area..."
    );

    // Login/session dibuat sekali saja sebelum request seluruh workzone.
    await getAuthenticatedSession();

    console.log(
      "[work-order-sync] memulai sinkronisasi seluruh Service Area..."
    );

    const allWorkOrders = [];
    const totalsByWorkZone = {};

    for (const workZone of getAllAllowedWorkZones()) {
      const workOrders = await fetchAllPagesForWorkZone(
        workZone,
        100
      );

      totalsByWorkZone[workZone] = workOrders.length;
      allWorkOrders.push(...workOrders);
    }

    const totalFetched = allWorkOrders.length;

    const uniqueWorkOrders = Array.from(
      new Map(
        allWorkOrders
          .filter(isAllowedWorkOrder)
          .map((workOrder) => [
            normalizeText(workOrder.woNumber),
            workOrder
          ])
      ).values()
    );

    if (uniqueWorkOrders.length === 0) {
      throw new Error(
        "Sync selesai tetapi tidak ada Work Order STARTWORK dari seluruh workzone."
      );
    }

    const syncedAt = new Date().toISOString();

    const databaseResult = saveWorkOrders(
      uniqueWorkOrders,
      syncedAt
    );

    cachedWorkOrders = uniqueWorkOrders.map(
      (workOrder) => ({
        ...workOrder,
        syncedAt
      })
    );

    lastSyncedAt = syncedAt;

    saveSyncSuccess(syncedAt);

    console.log("[work-order-sync] sinkronisasi berhasil", {
      totalFetched,
      totalAllowed: uniqueWorkOrders.length,
      totalSaved:
        databaseResult?.saved ?? uniqueWorkOrders.length,
      totalsByWorkZone,
      lastSyncedAt: syncedAt
    });

    return {
      skipped: false,
      totalFetched,
      totalAllowed: uniqueWorkOrders.length,
      totalSaved:
        databaseResult?.saved ?? uniqueWorkOrders.length,
      totalsByWorkZone,
      lastSyncedAt: syncedAt,
      workOrders: cachedWorkOrders
    };
  } catch (error) {
    console.error("[insera-sync-error]", error.message);

    try {
      saveSyncFailure(error.message);
    } catch (databaseError) {
      console.error(
        "[sync-failure-save-error]",
        databaseError.message
      );
    }

    throw error;
  } finally {
    isSyncing = false;
  }
}

function getStartworkByServiceArea(serviceAreaCode) {
  return getWorkOrdersByServiceArea(serviceAreaCode);
}

function getAllStartwork() {
  return getAllWorkOrders().filter(
    (workOrder) =>
      normalizeText(workOrder.status) === "STARTWORK"
  );
}

module.exports = {
  serviceAreas,
  getServiceAreaCodes,
  getServiceAreaByCode,
  getAllAllowedWorkZones,
  normalizeText,
  isAllowedWorkOrder,
  isWorkOrderInServiceArea,
  loadCachedWorkOrdersFromDatabase,
  getDataSource,
  getAllWorkOrders,
  getWorkOrdersByServiceArea,
  getSavedWorkOrdersByServiceArea,
  getStartworkByServiceArea,
  getAllStartwork,
  findWorkOrderByNumber,
  getLastSyncedAt,
  syncWorkOrdersFromInsera
};