const { workOrders: dummyWorkOrders } = require("../data/work-orders");

const {
  fetchWorkOrdersFromInsera
} = require("./insera-api-service");

const {
  saveWorkOrders,
  getAllSavedWorkOrders,
  findSavedWorkOrderByNumber,
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
    name: "SA Bululawang",
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
  return String(value || "").trim().toUpperCase();
}

function getAllAllowedWorkZones() {
  return Object.values(serviceAreas).flatMap(
    (serviceArea) => serviceArea.workZones
  );
}

function isAllowedWorkOrder(workOrder) {
  return getAllAllowedWorkZones().includes(
    normalizeText(workOrder.workZone)
  );
}

function getServiceAreaByCode(serviceAreaCode) {
  return serviceAreas[serviceAreaCode] || null;
}

function loadCachedWorkOrdersFromDatabase() {
  const savedWorkOrders = getAllSavedWorkOrders();

  if (savedWorkOrders.length === 0) {
    return {
      loaded: 0,
      lastSyncedAt: null
    };
  }

  cachedWorkOrders = savedWorkOrders;
  lastSyncedAt = getLatestSavedSyncAt();

  console.log("[work-order-cache] data SQLite dimuat", {
    loaded: cachedWorkOrders.length,
    lastSyncedAt
  });

  return {
    loaded: cachedWorkOrders.length,
    lastSyncedAt
  };
}

function getDataSource() {
  if (cachedWorkOrders.length > 0) {
    return cachedWorkOrders;
  }

  const savedWorkOrders = getAllSavedWorkOrders();

  if (savedWorkOrders.length > 0) {
    cachedWorkOrders = savedWorkOrders;
    lastSyncedAt = getLatestSavedSyncAt();

    return cachedWorkOrders;
  }

  return dummyWorkOrders;
}

function getWorkOrdersByServiceArea(serviceAreaCode) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  if (!serviceArea) {
    return [];
  }

  return getDataSource().filter((workOrder) =>
    serviceArea.workZones.includes(
      normalizeText(workOrder.workZone)
    )
  );
}

function getAllWorkOrders() {
  return getDataSource();
}

function findWorkOrderByNumber(woNumber) {
  const normalizedWoNumber = normalizeText(woNumber);

  const cachedWorkOrder = getDataSource().find(
    (workOrder) =>
      normalizeText(workOrder.woNumber) === normalizedWoNumber
  );

  if (cachedWorkOrder) {
    return cachedWorkOrder;
  }

  return findSavedWorkOrderByNumber(normalizedWoNumber);
}

function getLastSyncedAt(workOrders = []) {
  return (
    workOrders[0]?.syncedAt ||
    lastSyncedAt ||
    getLatestSavedSyncAt() ||
    null
  );
}

async function syncWorkOrdersFromInsera() {
  if (isSyncing) {
    return {
      skipped: true,
      totalFetched: 0,
      totalSaved: cachedWorkOrders.length,
      lastSyncedAt
    };
  }

  isSyncing = true;

  try {
    const MAX_PAGES = 10;
    const PAGE_SIZE = 100;

    const allWorkOrders = [];
    let totalJatim = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await fetchWorkOrdersFromInsera({
        page,
        pageSize: PAGE_SIZE
      });

      if (page === 1) {
        totalJatim = result.recordsFiltered;
      }

      allWorkOrders.push(...result.workOrders);

      if (result.workOrders.length < PAGE_SIZE) {
        break;
      }
    }

    const filteredWorkOrders = allWorkOrders.filter(
      isAllowedWorkOrder
    );

    if (filteredWorkOrders.length === 0) {
      throw new Error(
        "Sinkronisasi dibatalkan: tidak ada Work Order sesuai wilayah bot."
      );
    }

    const syncedAt = new Date().toISOString();

    const databaseResult = saveWorkOrders(
      filteredWorkOrders,
      syncedAt
    );

    cachedWorkOrders = filteredWorkOrders.map((workOrder) => ({
      ...workOrder,
      syncedAt
    }));

    lastSyncedAt = syncedAt;

    saveSyncSuccess(syncedAt);

    console.log("[insera-sync] berhasil", {
      fetched: allWorkOrders.length,
      saved: databaseResult.saved,
      totalJatim,
      source: "Insera API + SQLite"
    });

    return {
      skipped: false,
      totalFetched: allWorkOrders.length,
      totalSaved: databaseResult.saved,
      totalJatim,
      lastSyncedAt
    };
  } catch (error) {
    saveSyncFailure(error.message);

    console.error("[insera-sync-error]", error.message);

    throw error;
  } finally {
    isSyncing = false;
  }
}

module.exports = {
  getAllWorkOrders,
  getWorkOrdersByServiceArea,
  getServiceAreaByCode,
  findWorkOrderByNumber,
  getLastSyncedAt,
  loadCachedWorkOrdersFromDatabase,
  syncWorkOrdersFromInsera
};