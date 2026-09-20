const cron = require("node-cron");

const {
  syncWorkOrdersFromInsera
} = require("../services/work-order-service");

let isSyncRunning = false;

async function runWorkOrderSync() {
  if (isSyncRunning) {
    console.log("[work-order-sync] dilewati: sync sebelumnya masih berjalan.");
    return;
  }

  isSyncRunning = true;

  try {
    console.log("[work-order-sync] mengambil data Insera...");

    const result = await syncWorkOrdersFromInsera();

    console.log("[work-order-sync] selesai", result);
  } catch (error) {
    console.error("[work-order-sync-error]", error.message);
  } finally {
    isSyncRunning = false;
  }
}

function startWorkOrderSyncJob() {
  cron.schedule(
    "0 * * * *",
    async () => {
      await runWorkOrderSync();
    },
    {
      timezone: "Asia/Jakarta"
    }
  );

  console.log("[work-order-sync] scheduler aktif: setiap 1 jam.");

  runWorkOrderSync();
}

module.exports = {
  runWorkOrderSync,
  startWorkOrderSyncJob
};