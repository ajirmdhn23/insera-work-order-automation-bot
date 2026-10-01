const {
  runWorkOrderSync
} = require("../jobs/work-order-sync-job");

function registerDebugHandler(bot) {
  bot.command("syncdebug", async (ctx) => {
    try {
      await ctx.reply(
        "Memulai pengecekan sinkronisasi data Insera..."
      );

      const result = await runWorkOrderSync("syncdebug_command");

      if (result.skipped) {
        return ctx.reply(
          "Sync sedang berjalan. Tunggu proses sebelumnya selesai."
        );
      }

      return ctx.reply(
        `Sync selesai.
Data diterima: ${result.totalFetched}
Data tersimpan: ${result.totalSaved}
Waktu sync: ${result.lastSyncedAt || "-"}`
      );
    } catch (error) {
      console.error("[syncdebug-command-error]", error.message);

      return ctx.reply(
        `Sync gagal: ${error.message}`
      );
    }
  });
}

module.exports = {
  registerDebugHandler
};