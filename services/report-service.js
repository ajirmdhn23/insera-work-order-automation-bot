function formatDateWib(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const normalizedValue = String(dateValue).trim();

  if (!normalizedValue) {
    return "-";
  }

  const isoLikeValue = normalizedValue.includes("T")
    ? normalizedValue
    : normalizedValue.replace(" ", "T");

  const date = new Date(isoLikeValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "-")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function displayText(value) {
  const text = String(value ?? "").trim();

  return text ? escapeHtml(text) : "-";
}

function getWorkOrderPageInfo(workOrders, page = 1, pageSize = 10) {
  const totalItems = Array.isArray(workOrders)
    ? workOrders.length
    : 0;

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / pageSize)
  );

  const currentPage = Math.min(
    Math.max(Number(page) || 1, 1),
    totalPages
  );

  const startIndex = (currentPage - 1) * pageSize;

  const displayedWorkOrders = workOrders.slice(
    startIndex,
    startIndex + pageSize
  );

  return {
    currentPage,
    totalPages,
    startIndex,
    displayedWorkOrders
  };
}

function buildWorkOrderReport(
  workOrders,
  serviceAreaName = "Semua Wilayah",
  lastSyncedAt = null,
  page = 1,
  pageSize = 10
) {
  if (!workOrders || workOrders.length === 0) {
    return `📋 <b>Laporan Work Order</b>
━━━━━━━━━━━━━━━━━━━━

📍 Wilayah: <b>${displayText(serviceAreaName)}</b>

ℹ️ Tidak ada data Work Order untuk wilayah ini.

🕒 Data terakhir diperbarui: ${formatDateWib(lastSyncedAt)}`;
  }

  const {
    currentPage,
    totalPages,
    startIndex,
    displayedWorkOrders
  } = getWorkOrderPageInfo(
    workOrders,
    page,
    pageSize
  );

  const workOrderLines = displayedWorkOrders
    .map((workOrder, index) => {
      return `${startIndex + index + 1}. <code>${displayText(
        workOrder.woNumber
      )}</code> | <b>${displayText(workOrder.status)}</b>
📦 ${displayText(workOrder.description)}
📍 Zona: ${displayText(
        workOrder.workZone
      )} | Dibuat: ${formatDateWib(workOrder.createdAt)}`;
    })
    .join("\n\n");

  const firstItem = startIndex + 1;
  const lastItem = startIndex + displayedWorkOrders.length;

  return `📋 <b>Laporan Work Order</b>
━━━━━━━━━━━━━━━━━━━━

📍 Wilayah: <b>${displayText(serviceAreaName)}</b>
📊 Total Work Order: <b>${workOrders.length}</b>
🕒 Data terakhir diperbarui: <b>${formatDateWib(lastSyncedAt)}</b>

━━━━━━━━━━━━━━━━━━━━

${workOrderLines}

<i>Menampilkan ${firstItem}–${lastItem} dari ${
    workOrders.length
  } Work Order • Halaman ${currentPage}/${totalPages}</i>

━━━━━━━━━━━━━━━━━━━━
🔎 Pilih nomor Work Order pada tombol di bawah untuk melihat detail.`;
}

function buildDetailLine(
  icon,
  label,
  value,
  isDate = false
) {
  const displayedValue = isDate
    ? formatDateWib(value)
    : displayText(value);

  return `${icon} <b>${label}</b>: ${displayedValue}`;
}

function buildSection(title) {
  return `\n<b>${title}</b>`;
}

function buildWorkOrderDetail(workOrder, serviceAreaName, lastSyncedAt) {
  if (!workOrder) {
    return `⚠️ <b>Work Order tidak ditemukan.</b>

Buka menu <b>📋 Laporan Work Order</b> untuk melihat data yang tersedia.`;
  }

  const lines = [
    buildSection("🗂️ Informasi utama"),
    buildDetailLine("📅", "Date Created", workOrder.createdAt, true),
    buildDetailLine("📝", "Date Modified", workOrder.modifiedAt, true),
    buildDetailLine("🆔", "Work Order Number", workOrder.woNumber),
    buildDetailLine(
      "🔗",
      "SC Order Number / Track ID / CSRM No",
      workOrder.scOrderNumber
    ),
    buildDetailLine("🔐", "OSS Order ID", workOrder.ossOrderId),
    buildDetailLine("📞", "Service Number", workOrder.serviceNumber),

    buildSection("⚙️ Status dan produk"),
    buildDetailLine("🚦", "Status", workOrder.status),
    buildDetailLine("📝", "Description", workOrder.description),
    buildDetailLine("👥", "Owner Group", workOrder.ownerGroup),
    buildDetailLine("📦", "Product Name", workOrder.productName),
    buildDetailLine("🏷️", "CRM Order Type", workOrder.crmOrderType),
    buildDetailLine("📂", "WO Class", workOrder.woClass),
    buildDetailLine("🧩", "Product Type", workOrder.productType),

    buildSection("📍 Wilayah"),
    buildDetailLine("🗺️", "Work Zone", workOrder.workZone),
    buildDetailLine("🌏", "Area TIF", workOrder.area),
    buildDetailLine("🏢", "Regional TIF", workOrder.regional),
    buildDetailLine("📌", "District TIF", workOrder.district),
    buildDetailLine("🆔", "Region / Site ID", workOrder.regionSiteId),
    buildDetailLine(
      "📍",
      "Wilayah laporan",
      serviceAreaName || workOrder.locationName
    ),
    buildDetailLine("🏙️", "Witel", workOrder.witel),

    buildSection("👤 Pelanggan"),
    buildDetailLine("👤", "Customer Name", workOrder.customerName),
    buildDetailLine("🏠", "Address", workOrder.address),
    buildDetailLine("☎️", "Contact Number", workOrder.contactNumber),

    buildSection("🗓️ Jadwal"),
    buildDetailLine("🕒", "Status Date", workOrder.statusDate, true),
    buildDetailLine("⏱️", "Sched Start", workOrder.schedstart, true),
    buildDetailLine("📆", "Booking Date", workOrder.bookingDate, true),

    buildSection("📊 Data tambahan"),
    buildDetailLine("📏", "Measurement", workOrder.measurement),
    buildDetailLine(
      "📅",
      "Measurement Date",
      workOrder.measurementDate,
      true
    ),
    buildDetailLine(
      "✅",
      "Measurement Result",
      workOrder.measurementResult
    ),
    buildDetailLine(
      "📄",
      "No. Kontrak (KB/KL/P8)",
      workOrder.contractNumber
    ),
    buildDetailLine(
      "📡",
      "Channel ID TSEL",
      workOrder.channelIdTsel
    ),
    buildDetailLine(
      "🔖",
      "Order ID TSEL",
      workOrder.orderIdTsel
    )
  ];

  return `🔎 <b>Detail Work Order</b>
━━━━━━━━━━━━━━━━━━━━
${lines.join("\n")}

━━━━━━━━━━━━━━━━━━━━
🕒 Data terakhir diperbarui: <b>${formatDateWib(
    lastSyncedAt || workOrder.syncedAt
  )}</b>`;
}

module.exports = {
  formatDateWib,
  getWorkOrderPageInfo,
  buildWorkOrderReport,
  buildWorkOrderDetail
};