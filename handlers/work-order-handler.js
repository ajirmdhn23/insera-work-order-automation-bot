const { findUserByTelegramId } = require("../database/user-repository");

const {
  getAllWorkOrders,
  getWorkOrdersByServiceArea,
  findWorkOrderByNumber,
  getServiceAreaByCode,
  getLastSyncedAt
} = require("../services/work-order-service");

const {
  buildWorkOrderReport,
  buildWorkOrderDetail
} = require("../services/report-service");

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

function reportKeyboard(serviceAreaCode, page, totalPages) {
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

  return {
    serviceArea,
    workOrders,
    page,
    totalPages
  };
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
    totalPages
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
      totalPages
    )
  };

  if (editMessage) {
    return ctx.editMessageText(message, extra);
  }

  return ctx.reply(message, extra);
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
<code>/wo WO064XXXXXX</code>`,
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

    const serviceAreaName = getServiceAreaNameByWorkZone(
      workOrder.workZone
    );

    return ctx.reply(
      buildWorkOrderDetail(
        workOrder,
        serviceAreaName,
        getLastSyncedAt([workOrder])
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
}

module.exports = {
  registerWorkOrderHandler,
  showWorkOrderReport
};