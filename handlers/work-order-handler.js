const {
  findUserByTelegramId
} = require("../database/user-repository");

const {
  getAllWorkOrders,
  getWorkOrdersByServiceArea,
  findWorkOrderByNumber,
  getServiceAreaByCode,
  getLastSyncedAt
} = require("../services/work-order-service");

const {
  getWorkOrderPageInfo,
  buildWorkOrderReport,
  buildWorkOrderDetail
} = require("../services/report-service");

const {
  formatTanggalIndonesia,
  formatWaktuWib
} = require("../utils/date");

const WORK_ORDERS_PER_PAGE = 10;

function requireRegisteredUser(ctx) {
  const user = findUserByTelegramId(ctx.from.id);

  if (!user) {
    ctx.reply(
      "⚠️ Kamu belum terdaftar. Ketik /start untuk melakukan registrasi."
    );

    return null;
  }

  return user;
}

function normalizeText(value) {
  return String(value || "").trim().toUpperCase();
}

function extractWorkOrderNumber(ctx) {
  const messageText = String(ctx.message?.text || "").trim();

  const match = messageText.match(/^\/wo(?:@\w+)?\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return match[1].trim().toUpperCase();
}

function getServiceAreaNameByWorkZone(workZone) {
  const serviceAreaCodes = [
    "SA_BTU",
    "SA_BLB",
    "SA_KLJ",
    "SA_KEP",
    "SA_TUR",
    "SA_MLG",
    "SA_SWJ",
    "SA_BLR",
    "SA_TUL"
  ];

  const normalizedWorkZone = String(workZone || "")
    .trim()
    .toUpperCase();

  for (const serviceAreaCode of serviceAreaCodes) {
    const serviceArea = getServiceAreaByCode(serviceAreaCode);

    if (
      serviceArea &&
      Array.isArray(serviceArea.workZones) &&
      serviceArea.workZones.includes(normalizedWorkZone)
    ) {
      return serviceArea.name;
    }
  }

  return "Wilayah tidak diketahui";
}

function getDetailKeyboard(serviceAreaCode, page) {
  const buttons = [];

  if (serviceAreaCode) {
    buttons.push([
      {
        text: "⬅️ Kembali ke Laporan",
        callback_data: `WO_PAGE:${serviceAreaCode}:${page || 1}`
      }
    ]);
  }

  buttons.push([
    {
      text: "📍 Pilih Wilayah",
      callback_data: "MENU_WORK_ORDER"
    }
  ]);

  buttons.push([
    {
      text: "🏠 Menu Utama",
      callback_data: "BACK_TO_MAIN_MENU"
    }
  ]);

  return {
    inline_keyboard: buttons
  };
}

function reportKeyboard(
  serviceAreaCode,
  page,
  totalPages,
  displayedWorkOrders
) {
  const workOrderButtons = (displayedWorkOrders || []).map(
    (workOrder) => [
      {
        text: `🔎 ${workOrder.woNumber}`,
        callback_data: `WO_DETAIL:${serviceAreaCode}:${page}:${workOrder.woNumber}`
      }
    ]
  );

  const navigationButtons = [];

  if (page > 1) {
    navigationButtons.push({
      text: "⬅️ Sebelumnya",
      callback_data: `WO_PAGE:${serviceAreaCode}:${page - 1}`
    });
  }

  navigationButtons.push({
    text: `${page}/${totalPages}`,
    callback_data: "WO_PAGE_INFO"
  });

  if (page < totalPages) {
    navigationButtons.push({
      text: "Berikutnya ➡️",
      callback_data: `WO_PAGE:${serviceAreaCode}:${page + 1}`
    });
  }

  return {
    inline_keyboard: [
      ...workOrderButtons,
      ...(totalPages > 1 ? [navigationButtons] : []),
      [
        {
          text: "📍 Pilih Wilayah Lain",
          callback_data: "MENU_WORK_ORDER"
        }
      ],
      [
        {
          text: "🏠 Menu Utama",
          callback_data: "BACK_TO_MAIN_MENU"
        }
      ]
    ]
  };
}

function startworkReportKeyboard(page, totalPages) {
  const navigationButtons = [];

  if (page > 1) {
    navigationButtons.push({
      text: "⬅️ Sebelumnya",
      callback_data: `SC_PAGE:${page - 1}`
    });
  }

  navigationButtons.push({
    text: `${page}/${totalPages}`,
    callback_data: "SC_PAGE_INFO"
  });

  if (page < totalPages) {
    navigationButtons.push({
      text: "Berikutnya ➡️",
      callback_data: `SC_PAGE:${page + 1}`
    });
  }

  return {
    inline_keyboard: [
      ...(totalPages > 1 ? [navigationButtons] : []),
      [
        {
          text: "📍 Laporan Semua Work Order",
          callback_data: "MENU_WORK_ORDER"
        }
      ],
      [
        {
          text: "🏠 Menu Utama",
          callback_data: "BACK_TO_MAIN_MENU"
        }
      ]
    ]
  };
}

function getReportData(serviceAreaCode, requestedPage = 1) {
  const serviceArea = getServiceAreaByCode(serviceAreaCode);

  if (!serviceArea) {
    return null;
  }

  const workOrders = getWorkOrdersByServiceArea(serviceAreaCode);

  const totalPages = Math.max(
    1,
    Math.ceil(workOrders.length / WORK_ORDERS_PER_PAGE)
  );

  const page = Math.min(
    Math.max(Number(requestedPage) || 1, 1),
    totalPages
  );

  const pageInfo = getWorkOrderPageInfo(
    workOrders,
    page,
    WORK_ORDERS_PER_PAGE
  );

  return {
    serviceArea,
    workOrders,
    page,
    totalPages,
    displayedWorkOrders: pageInfo.displayedWorkOrders
  };
}

function getStartworkReportData(requestedPage = 1) {
  const workOrders = getAllWorkOrders().filter(
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

  return {
    workOrders,
    page,
    totalPages
  };
}

function formatLastUpdated(lastSyncedAt) {
  if (!lastSyncedAt) {
    return "Belum tersedia";
  }

  const syncDate = new Date(lastSyncedAt);

  if (Number.isNaN(syncDate.getTime())) {
    return "Belum tersedia";
  }

  return `${formatTanggalIndonesia(syncDate)} ${formatWaktuWib(
    syncDate
  )} WIB`;
}

function buildStartworkReport(workOrders, lastSyncedAt, page) {
  const lastUpdatedLabel = formatLastUpdated(lastSyncedAt);

  if (workOrders.length === 0) {
    return `📊 <b>Laporan STARTWORK</b>

Tidak ada Work Order dengan status <b>STARTWORK</b> saat ini.

🔄 Data terakhir diperbarui: <b>${lastUpdatedLabel}</b>`;
  }

  const startIndex = (page - 1) * WORK_ORDERS_PER_PAGE;

  const pageWorkOrders = workOrders.slice(
    startIndex,
    startIndex + WORK_ORDERS_PER_PAGE
  );

  const rows = pageWorkOrders.map((workOrder, index) => {
    const number = startIndex + index + 1;

    const serviceAreaName = getServiceAreaNameByWorkZone(
      workOrder.workZone
    );

    return `${number}. <code>${workOrder.woNumber}</code>
📍 ${serviceAreaName} • Zona: ${workOrder.workZone || "-"}
🏷️ ${workOrder.description || "Tanpa deskripsi"}`;
  });

  return `📊 <b>Laporan STARTWORK</b>

Total STARTWORK: <b>${workOrders.length}</b>
🔄 Data terakhir diperbarui: <b>${lastUpdatedLabel}</b>

${rows.join("\n\n")}

<i>Menampilkan ${startIndex + 1}–${
    startIndex + pageWorkOrders.length
  } dari ${workOrders.length} Work Order STARTWORK.</i>

🔎 Ketik <code>/wo NOMOR_WO</code> untuk melihat detail.`;
}

async function showStartworkReport(
  ctx,
  requestedPage = 1,
  editMessage = false
) {
  const { workOrders, page, totalPages } = getStartworkReportData(
    requestedPage
  );

  const message = buildStartworkReport(
    workOrders,
    getLastSyncedAt(workOrders),
    page
  );

  const extra = {
    parse_mode: "HTML",
    reply_markup: startworkReportKeyboard(page, totalPages)
  };

  if (editMessage) {
    return ctx.editMessageText(message, extra);
  }

  return ctx.reply(message, extra);
}

async function showWorkOrderReport(
  ctx,
  serviceAreaCode,
  requestedPage = 1,
  editMessage = false
) {
  const reportData = getReportData(
    serviceAreaCode,
    requestedPage
  );

  if (!reportData) {
    return ctx.reply("⚠️ Wilayah tidak ditemukan.");
  }

  const {
    serviceArea,
    workOrders,
    page,
    totalPages,
    displayedWorkOrders
  } = reportData;

  const message = buildWorkOrderReport(
    workOrders,
    serviceArea.name,
    getLastSyncedAt(workOrders),
    page,
    WORK_ORDERS_PER_PAGE
  );

  const extra = {
    parse_mode: "HTML",
    reply_markup: reportKeyboard(
      serviceAreaCode,
      page,
      totalPages,
      displayedWorkOrders
    )
  };

  if (editMessage) {
    return ctx.editMessageText(message, extra);
  }

  return ctx.reply(message, extra);
}

function buildWorkOrderDetailMessage(workOrder) {
  const serviceAreaName = getServiceAreaNameByWorkZone(
    workOrder.workZone
  );

  return buildWorkOrderDetail(
    workOrder,
    serviceAreaName,
    getLastSyncedAt([workOrder])
  );
}

function registerWorkOrderHandler(bot) {
  bot.command("report", (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const workOrders = getAllWorkOrders();

    return ctx.reply(
      buildWorkOrderReport(
        workOrders,
        "Semua Wilayah",
        getLastSyncedAt(workOrders),
        1,
        WORK_ORDERS_PER_PAGE
      ),
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📍 Pilih Wilayah",
                callback_data: "MENU_WORK_ORDER"
              }
            ],
            [
              {
                text: "🏠 Menu Utama",
                callback_data: "BACK_TO_MAIN_MENU"
              }
            ]
          ]
        }
      }
    );
  });

  bot.command("preview", (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const workOrders = getAllWorkOrders();

    return ctx.reply(
      buildWorkOrderReport(
        workOrders,
        "Semua Wilayah",
        getLastSyncedAt(workOrders),
        1,
        WORK_ORDERS_PER_PAGE
      ),
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📍 Pilih Wilayah",
                callback_data: "MENU_WORK_ORDER"
              }
            ],
            [
              {
                text: "🏠 Menu Utama",
                callback_data: "BACK_TO_MAIN_MENU"
              }
            ]
          ]
        }
      }
    );
  });

  bot.command("sc", async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return showStartworkReport(ctx);
  });

  bot.action(/^SC_PAGE:(\d+)$/, async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return ctx.answerCbQuery();
    }

    await ctx.answerCbQuery();

    return showStartworkReport(ctx, Number(ctx.match[1]), true);
  });

  bot.action("SC_PAGE_INFO", async (ctx) => {
    await ctx.answerCbQuery(
      "Gunakan tombol Sebelumnya atau Berikutnya."
    );
  });

  bot.action(/^WO_PAGE:([A-Z_]+):(\d+)$/, async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return ctx.answerCbQuery();
    }

    const [, serviceAreaCode, page] = ctx.match;

    await ctx.answerCbQuery();

    return showWorkOrderReport(
      ctx,
      serviceAreaCode,
      Number(page),
      true
    );
  });

  bot.action(
    /^WO_DETAIL:([A-Z_]+):(\d+):(.+)$/,
    async (ctx) => {
      const user = requireRegisteredUser(ctx);

      if (!user) {
        return ctx.answerCbQuery();
      }

      const [, serviceAreaCode, page, woNumber] = ctx.match;
      const workOrder = findWorkOrderByNumber(woNumber);

      if (!workOrder) {
        return ctx.answerCbQuery(
          "Work Order tidak ditemukan. Silakan refresh data.",
          { show_alert: true }
        );
      }

      await ctx.answerCbQuery("Membuka detail Work Order...");

      return ctx.editMessageText(
        buildWorkOrderDetailMessage(workOrder),
        {
          parse_mode: "HTML",
          reply_markup: getDetailKeyboard(
            serviceAreaCode,
            Number(page)
          )
        }
      );
    }
  );

  bot.action("WO_PAGE_INFO", async (ctx) => {
    await ctx.answerCbQuery(
      "Gunakan tombol Sebelumnya atau Berikutnya."
    );
  });

  bot.command("wo", async (ctx) => {
    console.log("[wo-command] diterima", {
      telegramId: ctx.from?.id,
      text: ctx.message?.text
    });

    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const woNumber = extractWorkOrderNumber(ctx);

    if (!woNumber) {
      return ctx.reply(
        `⚠️ Masukkan nomor Work Order setelah command.

Format:
<code>/wo NOMOR_WO</code>

Contoh:
<code>/wo W0064783278</code>`,
        {
          parse_mode: "HTML"
        }
      );
    }

    const workOrder = findWorkOrderByNumber(woNumber);

    if (!workOrder) {
      return ctx.reply(
        `⚠️ Nomor Work Order <code>${woNumber}</code> tidak ditemukan.

Buka menu <b>📋 Laporan Work Order</b> untuk melihat nomor Work Order yang tersedia.`,
        {
          parse_mode: "HTML"
        }
      );
    }

    return ctx.reply(
      buildWorkOrderDetailMessage(workOrder),
      {
        parse_mode: "HTML",
        reply_markup: getDetailKeyboard()
      }
    );
  });
}

module.exports = {
  registerWorkOrderHandler,
  showWorkOrderReport
};