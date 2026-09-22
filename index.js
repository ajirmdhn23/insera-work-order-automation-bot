require("dotenv").config();

const { Telegraf } = require("telegraf");

const { appName, dataMode } = require("./config/app");

const {
  registerStartHandler
} = require("./handlers/start-handler");

const {
  registerRegistrationHandler
} = require("./handlers/registration-handler");

const {
  registerMenuHandler
} = require("./handlers/menu-handler");

const {
  registerStatusHandler
} = require("./handlers/status-handler");

const {
  registerWorkOrderHandler
} = require("./handlers/work-order-handler");

const {
  startWorkOrderSyncJob,
  setStartworkNotificationHandler
} = require("./jobs/work-order-sync-job");

const {
  loadCachedWorkOrdersFromDatabase,
  getServiceAreaByCode
} = require("./services/work-order-service");

const {
  getActiveNotificationGroups
} = require("./database/group-repository");

const {
  formatTanggalIndonesia,
  formatWaktuWib
} = require("./utils/date");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN belum diisi pada file .env");
}

const bot = new Telegraf(token);

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

function formatWorkOrderSummary(workOrder) {
  return `• <code>${workOrder.woNumber}</code>
📍 ${getServiceAreaNameByWorkZone(
    workOrder.workZone
  )} • Zona: ${workOrder.workZone || "-"}
🏷️ ${workOrder.description || "Tanpa deskripsi"}`;
}

function buildStartworkNotificationMessage(changes, lastSyncedAt) {
  const parts = [];

  if (changes.newStartwork.length > 0) {
    parts.push(
      `🚨 <b>STARTWORK Baru (${changes.newStartwork.length})</b>

${changes.newStartwork.map(formatWorkOrderSummary).join("\n\n")}`
    );
  }

  if (changes.updatedStartwork.length > 0) {
    const updatedRows = changes.updatedStartwork.map(
      ({ previous, current }) =>
        `• <code>${current.woNumber}</code>
📍 ${getServiceAreaNameByWorkZone(
  current.workZone
)} • Zona: ${current.workZone || "-"}
🏷️ ${current.description || "Tanpa deskripsi"}
📝 Perubahan data STARTWORK terdeteksi`
    );

    parts.push(
      `📝 <b>STARTWORK Diperbarui (${changes.updatedStartwork.length})</b>

${updatedRows.join("\n\n")}`
    );
  }

  if (changes.endedStartwork.length > 0) {
    const endedRows = changes.endedStartwork.map(
      (workOrder) =>
        `• <code>${workOrder.woNumber}</code>
📍 ${getServiceAreaNameByWorkZone(
  workOrder.workZone
)} • Zona: ${workOrder.workZone || "-"}
⚠️ Tidak lagi terdeteksi sebagai STARTWORK`
    );

    parts.push(
      `⚠️ <b>STARTWORK Keluar/Status Berubah (${changes.endedStartwork.length})</b>

${endedRows.join("\n\n")}`
    );
  }

  const syncDate = new Date(lastSyncedAt);

  const detectedAt = Number.isNaN(syncDate.getTime())
    ? "Belum tersedia"
    : `${formatTanggalIndonesia(syncDate)} ${formatWaktuWib(
        syncDate
      )} WIB`;

  return `📢 <b>Notifikasi Perubahan STARTWORK</b>

${parts.join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n")}

━━━━━━━━━━━━━━━━━━━━
🕒 Terdeteksi: <b>${detectedAt}</b>
🔎 Gunakan <code>/wo NOMOR_WO</code> untuk melihat detail.`;
}

async function sendStartworkNotifications({
  changes,
  syncResult,
  trigger
}) {
  const groups = getActiveNotificationGroups();

  if (groups.length === 0) {
    console.log(
      "[startwork-notification] tidak ada grup aktif terdaftar."
    );

    return;
  }

  const message = buildStartworkNotificationMessage(
    changes,
    syncResult.lastSyncedAt
  );

  for (const group of groups) {
    try {
      await bot.telegram.sendMessage(group.chat_id, message, {
        parse_mode: "HTML"
      });

      console.log("[startwork-notification] terkirim", {
        group: group.chat_title,
        trigger
      });
    } catch (error) {
      console.error("[startwork-notification-send-error]", {
        group: group.chat_title,
        message: error.message
      });
    }
  }
}

setStartworkNotificationHandler(sendStartworkNotifications);

registerRegistrationHandler(bot);
registerStartHandler(bot);
registerMenuHandler(bot);
registerStatusHandler(bot);
registerWorkOrderHandler(bot);

bot.catch((error) => {
  console.error("[bot-error]", error.message);
});

async function main() {
  console.log("⏳ Mengecek koneksi ke Telegram...");

  try {
    const botInfo = await bot.telegram.getMe();

    console.log(`✅ Terhubung sebagai @${botInfo.username}`);

    loadCachedWorkOrdersFromDatabase();

    startWorkOrderSyncJob();

    console.log(`🤖 ${appName} sedang berjalan...`);
    console.log(`📦 Sumber data Work Order: ${dataMode}`);
    console.log("🗄️ Database SQLite: storage/insera-bot.db");

    await bot.launch();
  } catch (error) {
    console.error("❌ Gagal menghubungkan bot ke Telegram.");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[fatal-error]", error.message);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));