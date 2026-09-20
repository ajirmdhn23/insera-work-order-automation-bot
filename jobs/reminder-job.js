require("dotenv").config();

const { Telegraf } = require("telegraf");

const { appName, dataMode } = require("./config/app");
const { registerStartHandler } = require("./handlers/start-handler");
const { registerStatusHandler } = require("./handlers/status-handler");
const { registerWorkOrderHandler } = require("./handlers/work-order-handler");
const { startDailyReportJob } = require("./jobs/reminder-job");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN belum diisi pada file .env");
}

const bot = new Telegraf(token);

registerStartHandler(bot);
registerStatusHandler(bot);
registerWorkOrderHandler(bot);

bot.catch((error) => {
  console.error("[bot-error]", error.message);
});

async function main() {
  await bot.launch();

  console.log(`🤖 ${appName} sedang berjalan...`);
  console.log(`📦 Sumber data: ${dataMode}`);

  startDailyReportJob(bot);
}

main().catch((error) => {
  console.error("[fatal-error]", error.message);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));