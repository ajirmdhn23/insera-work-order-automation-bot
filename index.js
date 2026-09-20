require("dotenv").config();

const { Telegraf } = require("telegraf");

const { appName, dataMode } = require("./config/app");

const { registerStartHandler } = require("./handlers/start-handler");
const {
  registerRegistrationHandler
} = require("./handlers/registration-handler");
const { registerMenuHandler } = require("./handlers/menu-handler");
const { registerStatusHandler } = require("./handlers/status-handler");
const {
  registerWorkOrderHandler
} = require("./handlers/work-order-handler");

const {
  startWorkOrderSyncJob
} = require("./jobs/work-order-sync-job");

const {
  loadCachedWorkOrdersFromDatabase
} = require("./services/work-order-service");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN belum diisi pada file .env");
}

const bot = new Telegraf(token);

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

    // Ambil data Work Order terakhir dari SQLite terlebih dahulu.
    loadCachedWorkOrdersFromDatabase();

    // Jalankan sync pertama dan scheduler per jam sebelum long polling.
    startWorkOrderSyncJob();

    console.log(`🤖 ${appName} sedang berjalan...`);
    console.log(`📦 Sumber data Work Order: ${dataMode}`);
    console.log("🗄️ Database SQLite: storage/insera-bot.db");

    // Long polling Telegram dijalankan terakhir.
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