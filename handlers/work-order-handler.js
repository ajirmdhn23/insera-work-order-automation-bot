const {
  getWorkOrdersByServiceArea,
  findWorkOrderByNumber,
  getServiceAreaByCode,
  getLastSyncedAt
} = require("../services/work-order-service");

const {
  buildWorkOrderDetail
} = require("../services/report-service");

const {
  getPersonalSubscription
} = require("../database/subscription-repository");

const WORK_ORDERS_PER_PAGE = 10;

function normalizeText(value) {
  return String(value || "").trim().toUpperCase();
}

function getChatId(ctx) {
  return ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || null;
}

function extractWorkOrderNumber(ctx) {
  const messageText = String(ctx.message?.text || "").trim();

  const match = messageText.match(
    /^\/startwork(?:@\w+)?\s+(.+)$/i
  );

  if (!match) {
    return null;
  }

  return match[1].trim().toUpperCase();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const pad = (number) => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + ` ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function formatLastUpdated(value) {
  return value ? formatDateTime(value) : "Belum tersedia";
}

function reportKeyboard(serviceAreaCode, page, totalPages) {
  const rows = [];

  if (totalPages > 1) {
    const navigation = [];

    if (page > 1) {
      navigation.push({
        text: "⬅️ Sebelumnya",
        callback_data: `PERSONAL_STARTWORK_PAGE:${serviceAreaCode}:${page - 1}`
      });
    }

    navigation.push({
      text: `${page}/${totalPages}`,
      callback_data: "PERSONAL_PAGE_INFO"
    });

    if (page < totalPages) {
      navigation.push({
        text: "Berikutnya ➡️",
        callback_data: `PERSONAL_STARTWORK_PAGE:${serviceAreaCode}:${page + 1}`
      });
    }

    rows.push(navigation);
  }

  rows.push([
    {
      text: "⏰ Atur Interval",
      callback_data: "PERSONAL_INTERVAL_MENU"
    }
  ]);

  rows.push([
    {
      text: "📍 Ganti Service Area",
      callback_data: "PERSONAL_CHANGE_AREA"
    }
  ]);

  return {
    inline_keyboard: rows
  };
}

function getPersonalStartworkData(serviceAreaCode, requestedPage = 1) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  if (!serviceArea) {
    return null;
  }

  const workOrders = getWorkOrdersByServiceArea(serviceAreaCode).filter(
    (workOrder) => normalizeText(workOrder.status) === "STARTWORK"
  );

  const totalPages = Math.max(
    1,
    Math.ceil(workOrders.length / WORK_ORDERS_PER_PAGE)
  );

  const page = Math.min(
    Math.max(Number(requestedPage) || 1, 1),
    totalPages
  );

  const startIndex = (page - 1) * WORK_ORDERS_PER_PAGE;

  return {
    serviceArea,
    workOrders,
    page,
    totalPages,
    displayedWorkOrders: workOrders.slice(
      startIndex,
      startIndex + WORK_ORDERS_PER_PAGE
    )
  };
}

function buildPersonalStartworkReport(reportData) {
  const {
    serviceArea,
    workOrders,
    page,
    displayedWorkOrders
  } = reportData;

  const lastSyncedAt = getLastSyncedAt(workOrders);

  if (workOrders.length === 0) {
    return `📋 <b>Laporan STARTWORK — ${serviceArea.name}</b>

Tidak ada Work Order berstatus <b>STARTWORK</b> saat ini.

🔄 Data terakhir diperbarui: <b>${formatLastUpdated(
    lastSyncedAt
  )}</b>

Detail WO:
<code>/startwork NOMOR_WO</code>`;
  }

  const startIndex = (page - 1) * WORK_ORDERS_PER_PAGE;

  const rows = displayedWorkOrders.map((workOrder, index) => {
    const number = startIndex + index + 1;

    return `${number}. <code>${workOrder.woNumber || "-"}</code>
📅 ${formatDateTime(workOrder.createdAt)}
🔗 -
📊 Status: ${workOrder.status || "-"}
🗓️ Booking Date: ${formatDateTime(workOrder.bookingDate)}`;
  });

  return `📋 <b>Laporan STARTWORK — ${serviceArea.name}</b>

Total STARTWORK: <b>${workOrders.length}</b>
🔄 Data terakhir diperbarui: <b>${formatLastUpdated(
    lastSyncedAt
  )}</b>

${rows.join("\n\n")}

<i>Menampilkan ${startIndex + 1}–${
    startIndex + displayedWorkOrders.length
  } dari ${workOrders.length} Work Order.</i>

Detail WO:
<code>/startwork NOMOR_WO</code>`;
}

async function showPersonalStartworkReport(
  ctx,
  serviceAreaCode,
  requestedPage = 1,
  editMessage = false
) {
  const reportData = getPersonalStartworkData(
    serviceAreaCode,
    requestedPage
  );

  if (!reportData) {
    const message = "⚠️ Service Area tidak ditemukan.";

    if (editMessage) {
      return ctx.editMessageText(message);
    }

    return ctx.reply(message);
  }

  const message = buildPersonalStartworkReport(reportData);

  const extra = {
    parse_mode: "HTML",
    reply_markup: reportKeyboard(
      serviceAreaCode,
      reportData.page,
      reportData.totalPages
    )
  };

  if (editMessage) {
    return ctx.editMessageText(message, extra);
  }

  return ctx.reply(message, extra);
}

function isWorkOrderInServiceArea(workOrder, serviceAreaCode) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  return Boolean(
    serviceArea &&
      workOrder &&
      serviceArea.workZones.includes(
        normalizeText(workOrder.workZone)
      )
  );
}

function registerWorkOrderHandler(bot) {
  bot.action(
    /^PERSONAL_STARTWORK_PAGE:([A-Z_]+):(\d+)$/,
    async (ctx) => {
      const [, serviceAreaCode, page] = ctx.match;

      const subscription = getPersonalSubscription(getChatId(ctx));

      if (!subscription) {
        return ctx.answerCbQuery(
          "Pilih Service Area terlebih dahulu dengan /start.",
          { show_alert: true }
        );
      }

      if (subscription.service_area_code !== serviceAreaCode) {
        return ctx.answerCbQuery(
          "Kamu hanya dapat melihat Work Order wilayah yang dipilih.",
          { show_alert: true }
        );
      }

      await ctx.answerCbQuery();

      return showPersonalStartworkReport(
        ctx,
        serviceAreaCode,
        Number(page),
        true
      );
    }
  );

  bot.action("PERSONAL_PAGE_INFO", async (ctx) => {
    return ctx.answerCbQuery(
      "Gunakan tombol Sebelumnya atau Berikutnya."
    );
  });

  bot.command("startwork", async (ctx) => {
    const subscription = getPersonalSubscription(getChatId(ctx));

    if (!subscription) {
      return ctx.reply(
        "Pilih Service Area terlebih dahulu dengan command /start."
      );
    }

    const woNumber = extractWorkOrderNumber(ctx);

    if (!woNumber) {
      return ctx.reply(
        `⚠️ Masukkan nomor Work Order setelah command.

Format:
<code>/startwork NOMOR_WO</code>

Contoh:
<code>/startwork WO-KLJ-005</code>`,
        { parse_mode: "HTML" }
      );
    }

    const workOrder = findWorkOrderByNumber(woNumber);

    if (
      !workOrder ||
      !isWorkOrderInServiceArea(
        workOrder,
        subscription.service_area_code
      ) ||
      normalizeText(workOrder.status) !== "STARTWORK"
    ) {
      return ctx.reply(
        `⚠️ Work Order <code>${woNumber}</code> tidak ditemukan sebagai STARTWORK pada Service Area kamu.`,
        { parse_mode: "HTML" }
      );
    }

    return ctx.reply(
      buildWorkOrderDetail(
        workOrder,
        getServiceAreaByCode(
          subscription.service_area_code
        ).name,
        getLastSyncedAt([workOrder])
      ),
      { parse_mode: "HTML" }
    );
  });
}

module.exports = {
  registerWorkOrderHandler,
  showPersonalStartworkReport
};