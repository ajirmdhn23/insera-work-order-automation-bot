const axios = require("axios");

function getTodayWib() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getDateDaysAgoWib(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function createFilters({
  dateFrom,
  dateTo,
  workZone = "",
  workOrderNumber = ""
}) {
  return {
    C_STATUS: "",
    C_OWNERGROUP: "",
    C_WONUM: String(workOrderNumber).trim().toUpperCase(),
    C_AREA_TIF: process.env.INSERA_AREA_TIF || "JAWA BALI",
    C_REGIONAL_TIF: process.env.INSERA_REGIONAL_TIF || "JATIM",
    C_DISTRICT_TIF: "",
    C_SCORDERNO: "",
    C_JMSCORRELATIONID: "",
    C_SERVICENUM: "",
    C_WORKZONE: String(workZone).trim().toUpperCase(),
    C_DESCRIPTION: "",
    C_TK_WORKORDER_04: "",
    C_CUSTOMER_NAME: "",
    C_CONTACT_TELEPHONE_NUMBER: "",
    C_WOCLASS: "",
    C_CRMORDERTYPE: "",
    C_SERVICEADDRESS: "",
    C_SCHEDSTART: "",
    C_PRODUCTNAME: "",
    C_TK_SUBREGION: "",
    C_PRODUCTTYPE: "",
    C_CHANNELID_TSEL: "",
    C_ORDERID_TSEL: "",
    C_SITEID: "",
    DATECREATED_FROM: dateFrom,
    DATECREATED_TO: dateTo
  };
}

function buildWorkOrderPayload({
  page = 1,
  pageSize = 30,
  dateFrom = getDateDaysAgoWib(30),
  dateTo = getTodayWib(),
  workZone = "",
  workOrderNumber = ""
} = {}) {
  return {
    filters: createFilters({
      dateFrom,
      dateTo,
      workZone,
      workOrderNumber
    }),
    page,
    pageSize,
    SORT: "DESC",
    ORDER_BY: "datecreated"
  };
}

function normalizeWorkOrder(raw) {
  return {
    woNumber: raw.c_wonum || "",
    workZone: raw.c_workzone || "",
    status: raw.c_status || "",
    description: raw.c_description || "",
    ownerGroup: raw.c_ownergroup || "",
    productName: raw.c_productname || "",
    productType: raw.c_producttype || "",
    crmOrderType: raw.c_crmordertype || "",
    createdAt: raw.datecreated || "",
    modifiedAt: raw.datemodified || "",
    statusDate: raw.c_statusdate || "",
    schedstart: raw.c_schedstart || "",
    bookingDate: raw.c_bookingdate || "",
    regional: raw.c_regional_tif || "",
    area: raw.c_area_tif || "",
    district: raw.c_district_tif || "",
    syncedAt: new Date().toISOString()
  };
}

async function fetchWorkOrdersFromInsera(options = {}) {
  const apiUrl = process.env.INSERA_WORK_ORDER_API_URL;

  if (!apiUrl) {
    throw new Error("INSERA_WORK_ORDER_API_URL belum diisi di .env.");
  }

  const payload = buildWorkOrderPayload(options);

  const response = await axios.post(apiUrl, payload, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    },
    timeout: 30000,
    maxRedirects: 0,
    validateStatus: () => true
  });

  const contentType = String(
    response.headers["content-type"] || ""
  ).toLowerCase();

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `Insera mengarahkan request ke halaman lain (HTTP ${response.status}). Session login diperlukan.`
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Insera menolak request (HTTP ${response.status}). Session login diperlukan.`
    );
  }

  if (response.status >= 400) {
    throw new Error(
      `Insera mengembalikan error HTTP ${response.status}.`
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Respons Insera bukan JSON. Kemungkinan request diarahkan ke halaman login; session login diperlukan."
    );
  }

  const data = response.data || {};

  return {
    page: Number(data.page || options.page || 1),
    recordsTotal: Number(data.recordsTotal || 0),
    recordsFiltered: Number(data.recordsFiltered || 0),
    totalPages: Number(data.totalPages || 0),
    rowsPerPage: Number(data.rowsPerPage || options.pageSize || 30),
    workOrders: Array.isArray(data.workorders)
      ? data.workorders.map(normalizeWorkOrder)
      : []
  };
}

module.exports = {
  buildWorkOrderPayload,
  fetchWorkOrdersFromInsera,
  normalizeWorkOrder
};