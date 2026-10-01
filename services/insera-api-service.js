const axios = require("axios");

const {
  getAuthenticatedSession,
  clearSession
} = require("./insera-auth-service");

function formatDateWib(date) {
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

function getTodayWib() {
  return formatDateWib(new Date());
}

function getYesterdayWib() {
  const todayWib = getTodayWib();
  const [year, month, day] = todayWib.split("-").map(Number);

  return formatDateWib(
    new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0))
  );
}

function getApiOrigin(apiUrl) {
  try {
    return new URL(apiUrl).origin;
  } catch {
    throw new Error(
      "INSERA_WORK_ORDER_API_URL harus berupa URL lengkap."
    );
  }
}

function getEnvUpper(name, fallback = "") {
  return String(process.env[name] || fallback)
    .trim()
    .toUpperCase();
}

function pickRawValue(raw, keys) {
  for (const key of keys) {
    const value = raw?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function createFilters({
  dateFrom,
  dateTo,
  workZone = "",
  workOrderNumber = ""
}) {
  const selectedWorkZone = String(
    workZone || process.env.INSERA_WORKZONE || ""
  )
    .trim()
    .toUpperCase();

  return {
    C_STATUS: getEnvUpper("INSERA_WO_STATUS", "STARTWORK"),
    C_OWNERGROUP: "",
    C_WONUM: String(workOrderNumber).trim().toUpperCase(),

    C_AREA_TIF: getEnvUpper("INSERA_AREA_TIF", "JAWA BALI"),
    C_REGIONAL_TIF: getEnvUpper("INSERA_REGIONAL_TIF", "JATIM"),

    C_DISTRICT_TIF: "",
    C_SCORDERNO: "",
    C_JMSCORRELATIONID: "",
    C_SERVICENUM: "",
    C_WORKZONE: selectedWorkZone,

    C_DESCRIPTION: "",
    C_TK_WORKORDER_04: "",
    C_CUSTOMER_NAME: "",
    C_CONTACT_TELEPHONE_NUMBER: "",
    C_WOCLASS: "",

    // Disamakan dengan filter aktif di website Insera.
    C_CRMORDERTYPE: getEnvUpper(
      "INSERA_CRM_ORDER_TYPE",
      "CREATE"
    ),

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
  pageSize = 100,
  dateFrom,
  dateTo,
  workZone = "",
  workOrderNumber = ""
} = {}) {
  const yesterdayWib = getYesterdayWib();
  const todayWib = getTodayWib();

  return {
    filters: createFilters({
      dateFrom: dateFrom || yesterdayWib,
      dateTo: dateTo || todayWib,
      workZone,
      workOrderNumber
    }),
    page: Number(page),
    pageSize: Number(pageSize),
    SORT: "DESC",
    ORDER_BY: "datecreated"
  };
}

function normalizeWorkOrder(raw = {}) {
  return {
    createdAt: pickRawValue(raw, [
      "datecreated",
      "DATECREATED",
      "created_at"
    ]),
    modifiedAt: pickRawValue(raw, [
      "datemodified",
      "DATEMODIFIED",
      "modified_at"
    ]),
    woNumber: pickRawValue(raw, [
      "cwonum",
      "c_wonum",
      "C_WONUM",
      "wonum",
      "WO_NUMBER"
    ]),
    scOrderNumber: pickRawValue(raw, [
      "cscorderno",
      "c_scorderno",
      "C_SCORDERNO",
      "scorderno",
      "sc_order_number"
    ]),
    ossOrderId: pickRawValue(raw, [
      "cossorderid",
      "c_ossorderid",
      "C_OSSORDERID",
      "ossorderid",
      "oss_order_id"
    ]),
    serviceNumber: pickRawValue(raw, [
      "cservicenum",
      "c_servicenum",
      "C_SERVICENUM",
      "servicenum",
      "service_number"
    ]),
    status: pickRawValue(raw, [
      "cstatus",
      "c_status",
      "C_STATUS",
      "status"
    ]),
    description: pickRawValue(raw, [
      "cdescription",
      "c_description",
      "C_DESCRIPTION",
      "description"
    ]),
    ownerGroup: pickRawValue(raw, [
      "cownergroup",
      "c_ownergroup",
      "C_OWNERGROUP",
      "ownergroup",
      "owner_group"
    ]),
    productName: pickRawValue(raw, [
      "cproductname",
      "c_productname",
      "C_PRODUCTNAME",
      "productname",
      "product_name"
    ]),
    crmOrderType: pickRawValue(raw, [
      "ccrmordertype",
      "c_crmordertype",
      "C_CRMORDERTYPE",
      "crmordertype",
      "crm_order_type"
    ]),
    workZone: pickRawValue(raw, [
      "cworkzone",
      "c_workzone",
      "C_WORKZONE",
      "workzone",
      "work_zone"
    ]),
    area: pickRawValue(raw, [
      "careatif",
      "c_area_tif",
      "C_AREA_TIF",
      "area_tif"
    ]),
    regional: pickRawValue(raw, [
      "cregionaltif",
      "c_regional_tif",
      "C_REGIONAL_TIF",
      "regional_tif"
    ]),
    district: pickRawValue(raw, [
      "cdistricttif",
      "c_district_tif",
      "C_DISTRICT_TIF",
      "district_tif"
    ]),
    regionSiteId: pickRawValue(raw, [
      "csiteid",
      "c_siteid",
      "C_SITEID",
      "siteid",
      "site_id"
    ]),
    customerName: pickRawValue(raw, [
      "ccustomername",
      "c_customer_name",
      "C_CUSTOMER_NAME",
      "customer_name",
      "customername"
    ]),
    address: pickRawValue(raw, [
      "cserviceaddress",
      "c_serviceaddress",
      "C_SERVICEADDRESS",
      "serviceaddress",
      "service_address",
      "address"
    ]),
    witel: pickRawValue(raw, [
      "cwitel",
      "c_witel",
      "C_WITEL",
      "witel"
    ]),
    statusDate: pickRawValue(raw, [
      "cstatusdate",
      "c_statusdate",
      "C_STATUSDATE",
      "statusdate",
      "status_date"
    ]),
    schedstart: pickRawValue(raw, [
      "cschedstart",
      "c_schedstart",
      "C_SCHEDSTART",
      "schedstart",
      "sched_start"
    ]),
    contactNumber: pickRawValue(raw, [
      "ccontacttelephonenumber",
      "c_contact_telephone_number",
      "C_CONTACT_TELEPHONE_NUMBER",
      "contact_telephone_number",
      "contact_number"
    ]),
    measurement: pickRawValue(raw, [
      "cmeasurement",
      "c_measurement",
      "C_MEASUREMENT",
      "measurement"
    ]),
    measurementDate: pickRawValue(raw, [
      "cmeasurementdate",
      "c_measurement_date",
      "C_MEASUREMENT_DATE",
      "measurement_date"
    ]),
    measurementResult: pickRawValue(raw, [
      "cmeasurementresult",
      "c_measurement_result",
      "C_MEASUREMENT_RESULT",
      "measurement_result"
    ]),
    woClass: pickRawValue(raw, [
      "cwoclass",
      "c_woclass",
      "C_WOCLASS",
      "woclass",
      "wo_class"
    ]),
    contractNumber: pickRawValue(raw, [
      "ctkworkorder04",
      "c_tk_workorder_04",
      "C_TK_WORKORDER_04",
      "c_no_kontrak",
      "contract_number"
    ]),
    productType: pickRawValue(raw, [
      "cproducttype",
      "c_producttype",
      "C_PRODUCTTYPE",
      "producttype",
      "product_type"
    ]),
    bookingDate: pickRawValue(raw, [
      "cbookingdate",
      "c_bookingdate",
      "C_BOOKINGDATE",
      "bookingdate",
      "booking_date"
    ]),
    channelIdTsel: pickRawValue(raw, [
      "cchannelidtsel",
      "c_channelid_tsel",
      "C_CHANNELID_TSEL",
      "channelid_tsel",
      "channel_id_tsel"
    ]),
    orderIdTsel: pickRawValue(raw, [
      "corderidtsel",
      "c_orderid_tsel",
      "C_ORDERID_TSEL",
      "orderid_tsel",
      "order_id_tsel"
    ]),
    locationCode: pickRawValue(raw, [
      "location_code",
      "c_location_code"
    ]),
    locationName: pickRawValue(raw, [
      "location_name",
      "c_location_name"
    ]),
    syncedAt: new Date().toISOString()
  };
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} belum diisi di .env.`);
  }

  return value;
}

function getRawWorkOrders(data) {
  if (Array.isArray(data?.workorders)) {
    return data.workorders;
  }

  if (Array.isArray(data?.workOrders)) {
    return data.workOrders;
  }

  if (Array.isArray(data?.data?.workorders)) {
    return data.data.workorders;
  }

  if (Array.isArray(data?.data?.workOrders)) {
    return data.data.workOrders;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  return [];
}

function responseLooksLikeLoginPage(response) {
  const responseUrl = String(
    response?.request?.res?.responseUrl || ""
  ).toLowerCase();

  const contentType = String(
    response?.headers?.["content-type"] || ""
  ).toLowerCase();

  const body =
    typeof response?.data === "string"
      ? response.data.toLowerCase().slice(0, 5000)
      : "";

  return (
    responseUrl.includes("insera-sso.telkom.co.id") ||
    responseUrl.includes("/jw/web/login") ||
    contentType.includes("text/html") ||
    body.includes("enter otp") ||
    body.includes("time-based one-time password") ||
    (body.includes("joget") && body.includes("login"))
  );
}

function isUnauthorizedResponse(response) {
  const code = String(
    response?.data?.code ?? response?.status ?? ""
  );

  const message = String(
    response?.data?.message ?? response?.data?.msg ?? ""
  ).toLowerCase();

  return (
    response?.status === 401 ||
    response?.status === 403 ||
    code === "401" ||
    code === "403" ||
    message.includes("unauthorized") ||
    message.includes("please login") ||
    responseLooksLikeLoginPage(response)
  );
}

async function requestWorkOrders(apiUrl, payload, cookieHeader) {
  const apiOrigin = getApiOrigin(apiUrl);

  return axios.post(apiUrl, payload, {
    timeout: 60_000,
    maxRedirects: 5,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: apiOrigin,
      Referer:
        "https://wfm.telkom.co.id/jw/web/userview/new_wfm/v/_/workorderlist",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
    },
    validateStatus: () => true
  });
}

async function getWorkOrderResponse(apiUrl, payload) {
  let session = await getAuthenticatedSession();

  let response = await requestWorkOrders(
    apiUrl,
    payload,
    session.cookieHeader
  );

  if (!isUnauthorizedResponse(response)) {
    return response;
  }

  console.log(
    "[insera-api] sesi API ditolak/diarahkan ke login; login ulang sekali..."
  );

  await clearSession();

  session = await getAuthenticatedSession();

  response = await requestWorkOrders(
    apiUrl,
    payload,
    session.cookieHeader
  );

  return response;
}

async function fetchWorkOrdersFromInsera(options = {}) {
  const apiUrl = getRequiredEnv("INSERA_WORK_ORDER_API_URL");
  const payload = buildWorkOrderPayload(options);

  console.log("[insera-api] mengambil Work Order:", {
    page: payload.page,
    pageSize: payload.pageSize,
    filters: payload.filters
  });

  const response = await getWorkOrderResponse(apiUrl, payload);

  const contentType = String(
    response.headers["content-type"] || ""
  ).toLowerCase();

  if (isUnauthorizedResponse(response)) {
    throw new Error(
      "Sesi API Work Order tetap ditolak setelah login ulang."
    );
  }

  if (response.status === 504) {
    throw new Error(
      "WFM Gateway Time-out. Coba lagi beberapa menit."
    );
  }

  if (response.status >= 400) {
    throw new Error(
      `Insera mengembalikan error HTTP ${response.status}.`
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Respons Work Order bukan JSON (${contentType || "tanpa Content-Type"}).`
    );
  }

  const data = response.data || {};
  const rawWorkOrders = getRawWorkOrders(data);

  console.log("[insera-api-debug]", {
    status: response.status,
    page: payload.page,
    workZone: payload.filters.C_WORKZONE,
    dateFrom: payload.filters.DATECREATED_FROM,
    dateTo: payload.filters.DATECREATED_TO,
    statusFilter: payload.filters.C_STATUS,
    crmOrderTypeFilter: payload.filters.C_CRMORDERTYPE,
    responseCode: data.code ?? data.status ?? null,
    responseMessage: data.message ?? data.msg ?? null,
    responseKeys: Object.keys(data),
    recordsTotal: data.recordsTotal,
    recordsFiltered: data.recordsFiltered,
    rawWorkOrdersCount: rawWorkOrders.length
  });

  return {
    page: Number(data.page || payload.page || 1),
    recordsTotal: Number(data.recordsTotal || 0),
    recordsFiltered: Number(data.recordsFiltered || 0),
    totalPages: Number(data.totalPages || 0),
    rowsPerPage: Number(
      data.rowsPerPage || payload.pageSize || 100
    ),
    workOrders: rawWorkOrders.map(normalizeWorkOrder)
  };
}

module.exports = {
  getTodayWib,
  getYesterdayWib,
  buildWorkOrderPayload,
  fetchWorkOrdersFromInsera,
  normalizeWorkOrder
};