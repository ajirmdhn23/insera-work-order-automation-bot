function formatDateWib(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

📍 Wilayah: <b>${escapeHtml(serviceAreaName)}</b>

ℹ️ Tidak ada data Work Order untuk wilayah ini.

🔄 Jadwal pembaruan: setiap 1 jam
🕒 Sinkronisasi terakhir: ${formatDateWib(lastSyncedAt)}`;
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
      return `${startIndex + index + 1}. <code>${escapeHtml(workOrder.woNumber)}</code> | <b>${escapeHtml(workOrder.status)}</b>
   ${escapeHtml(workOrder.description)}
   Zona: ${escapeHtml(workOrder.workZone)} | Dibuat: ${formatDateWib(workOrder.createdAt)}`;
    })
    .join("\n\n");

  const firstItem = startIndex + 1;
  const lastItem = startIndex + displayedWorkOrders.length;

  return `📋 <b>Laporan Work Order</b>
━━━━━━━━━━━━━━━━━━━━

📍 Wilayah: <b>${escapeHtml(serviceAreaName)}</b>
📊 Total Work Order: <b>${workOrders.length}</b>
🔄 Jadwal pembaruan: setiap 1 jam
🕒 Data terakhir diperbarui: <b>${formatDateWib(lastSyncedAt)}</b>

━━━━━━━━━━━━━━━━━━━━

${workOrderLines}

<i>Menampilkan ${firstItem}–${lastItem} dari ${workOrders.length} Work Order • Halaman ${currentPage}/${totalPages}</i>

━━━━━━━━━━━━━━━━━━━━
🔎 <b>Melihat detail Work Order</b>

Ketik:
<code>/wo NOMOR_WO</code>

Contoh format:
<code>/wo WO064XXXXXX</code>

Salin salah satu nomor WO dari daftar di atas, lalu tempel setelah <code>/wo</code>.`;
}

function buildWorkOrderDetail(workOrder, serviceAreaName, lastSyncedAt) {
  if (!workOrder) {
    return `⚠️ <b>Work Order tidak ditemukan.</b>

Gunakan format:
<code>/wo NOMOR_WO</code>

Buka menu <b>📋 Laporan Work Order</b> untuk melihat nomor WO yang tersedia.`;
  }

  return `🔎 <b>Detail Work Order</b>
━━━━━━━━━━━━━━━━━━━━

🆔 Nomor WO: <code>${escapeHtml(workOrder.woNumber)}</code>
📍 Wilayah: <b>${escapeHtml(serviceAreaName || workOrder.locationName)}</b>
🗺️ Work Zone: <b>${escapeHtml(workOrder.workZone)}</b>

📌 Status: <b>${escapeHtml(workOrder.status)}</b>
📝 Deskripsi: ${escapeHtml(workOrder.description)}
👥 Owner Group: ${escapeHtml(workOrder.ownerGroup)}

📦 Produk: ${escapeHtml(workOrder.productName)}
🏷️ Tipe Produk: ${escapeHtml(workOrder.productType)}
📋 CRM Order Type: ${escapeHtml(workOrder.crmOrderType)}

📅 Dibuat: ${formatDateWib(workOrder.createdAt)}
✏️ Diubah: ${formatDateWib(workOrder.modifiedAt)}
🕒 Status Date: ${formatDateWib(workOrder.statusDate)}
⏱️ Jadwal Mulai: ${formatDateWib(workOrder.schedstart)}
🗓️ Booking Date: ${formatDateWib(workOrder.bookingDate)}

━━━━━━━━━━━━━━━━━━━━
🔄 Jadwal pembaruan: setiap 1 jam
🕒 Data terakhir diperbarui: <b>${formatDateWib(lastSyncedAt || workOrder.syncedAt)}</b>`;
}

module.exports = {
  formatDateWib,
  getWorkOrderPageInfo,
  buildWorkOrderReport,
  buildWorkOrderDetail
};