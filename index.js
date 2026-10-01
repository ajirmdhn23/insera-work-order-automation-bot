require("dotenv").config();

const { Telegraf } = require("telegraf");

const { appName, dataMode } = require("./config/app");

const {
  registerStartHandler
} = require("./handlers/start-handler");

const {
  registerMenuHandler
} = require("./handlers/menu-handler");

const {
  registerWorkOrderHandler
} = require("./handlers/work-order-handler");

const {
  registerDebugHandler
} = require("./handlers/debug-handler");

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

registerStartHandler(bot);
registerMenuHandler(bot);
registerWorkOrderHandler(bot);
registerDebugHandler(bot);

bot.catch((error) => {
  console.error("[bot-error]", error.message);
});

async function main() {
  console.log("Mengecek koneksi ke Telegram...");

  try {
    const botInfo = await bot.telegram.getMe();

    console.log(`Terhubung sebagai @${botInfo.username}`);

    loadCachedWorkOrdersFromDatabase();
    startWorkOrderSyncJob();

    console.log(`${appName} sedang berjalan...`);
    console.log(`Sumber data Work Order: ${dataMode}`);
    console.log("Database SQLite: storage/insera-bot.db");

    await bot.launch();
  } catch (error) {
    console.error("[fatal-error]", error.message);
    process.exit(1);
  }
}

main();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));