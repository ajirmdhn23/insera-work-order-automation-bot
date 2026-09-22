const { dataMode } = require("../config/app");

const {
  findUserByTelegramId
} = require("../database/user-repository");

const {
  registerNotificationGroup,
  getActiveNotificationGroups
} = require("../database/group-repository");

const {
  formatTanggalIndonesia,
  formatWaktuWib
} = require("../utils/date");

const {
  getAllWorkOrders,
  getLastSyncedAt
} = require("../services/work-order-service");

const {
  runWorkOrderSync,
  getIntervalLabel,
  getWorkOrderSyncStatus
} = require("../jobs/work-order-sync-job");

function requireRegisteredUser(ctx) {
  const user = findUserByTelegramId(ctx.from.id);

  if (!user) {
    ctx.reply(
      "⚠️ Kamu belum terdaftar. Ketik /start lalu tekan tombol 📝 Registrasi."
    );

    return null;
  }

  return user;
}

function formatDateTime(value) {
  if (!value) {
    return "Belum tersedia";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Belum tersedia";
  }

  return `${formatTanggalIndonesia(date)} ${formatWaktuWib(date)} WIB`;
}

function formatDuration(startedAt, finishedAt, isRunning) {
  if (!startedAt) {
    return "Belum tersedia";
  }

  const startTime = new Date(startedAt).getTime();
  const endTime = isRunning
    ? Date.now()
    : new Date(finishedAt || startedAt).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return "Belum tersedia";
  }

  const durationMs = Math.max(0, endTime - startTime);

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} detik`;
}

function formatUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];

  if (days > 0) {
    parts.push(`${days} hari`);
  }

  if (hours > 0 || days > 0) {
    parts.push(`${hours} jam`);
  }

  parts.push(`${minutes} menit`);

  return parts.join(" ");
}

function formatMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getStartworkCount(workOrders) {
  return workOrders.filter(
    (workOrder) =>
      String(workOrder.status || "")
        .trim()
        .toUpperCase() === "STARTWORK"
  ).length;
}

function getSyncStatusLabel(syncStatus) {
  if (syncStatus.isRunning) {
    return "⏳ Sedang berjalan";
  }

  if (syncStatus.lastError) {
    return "🔴 Gagal";
  }

  if (syncStatus.lastResult) {
    return "🟢 Berhasil";
  }

  return "⚪ Belum pernah sync";
}

function buildStatusMessage(user) {
  const syncStatus = getWorkOrderSyncStatus();
  const workOrders = getAllWorkOrders();
  const groups = getActiveNotificationGroups();
  const lastCacheSyncAt = getLastSyncedAt(workOrders);
  const memory = process.memoryUsage();

  const lastSyncTime = syncStatus.lastFinishedAt || syncStatus.lastStartedAt;
  const syncTimeLabel = formatDateTime(lastSyncTime);
  const cacheSyncLabel = formatDateTime(lastCacheSyncAt);
  const errorLabel = syncStatus.lastError
    ? syncStatus.lastError
    : "-";

  return `📊 <b>STATUS BOT INSERA</b>

🤖 <b>Bot</b>
• Status: <b>aktif</b>
• Telegram: <b>terhubung</b>
• Waktu WIB: ${formatTanggalIndonesia()} ${formatWaktuWib()} WIB
• User: ${user.full_name}
• Unit: ${user.work_unit}

🔄 <b>Sinkronisasi Work Order</b>
• Interval: <b>${getIntervalLabel(
    syncStatus.intervalMinutes
  )}</b>
• Status terakhir: <b>${getSyncStatusLabel(syncStatus)}</b>
• Sync terakhir: <b>${syncTimeLabel}</b>
• Durasi: <b>${formatDuration(
    syncStatus.lastStartedAt,
    syncStatus.lastFinishedAt,
    syncStatus.isRunning
  )}</b>
• Data cache: <b>${workOrders.length} WO</b>
• STARTWORK aktif: <b>${getStartworkCount(workOrders)} WO</b>
• Error terakhir: <code>${errorLabel}</code>

🗄️ <b>Database</b>
• SQLite: <b>dapat diakses</b>
• Sumber data: <b>${dataMode}</b>
• Cache terakhir: <b>${cacheSyncLabel}</b>

📢 <b>Notifikasi</b>
• Grup aktif: <b>${groups.length}</b>
• Sistem notifikasi STARTWORK: <b>aktif</b>

💾 <b>Proses</b>
• Uptime: <b>${formatUptime(process.uptime())}</b>
• RAM (RSS): <b>${formatMegabytes(memory.rss)}</b>
• Node.js: <b>${process.version}</b>`;
}

function formatSyncResult(result) {
  if (result.skipped) {
    return `⏳ <b>Sinkronisasi sedang berjalan.</b>

Refresh tidak dijalankan karena proses pembaruan data sebelumnya belum selesai.`;
  }

  const updatedLabel = formatDateTime(result.lastSyncedAt);

  return `✅ <b>Refresh data berhasil.</b>

📥 Data diambil dari Insera: <b>${result.totalFetched}</b>
💾 Work Order disimpan: <b>${result.totalSaved}</b>
🕒 Pembaruan terakhir: <b>${updatedLabel}</b>`;
}

function isGroupChat(ctx) {
  return ["group", "supergroup"].includes(ctx.chat?.type);
}

function registerStatusHandler(bot) {
  bot.command("status", (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return ctx.reply(buildStatusMessage(user), {
      parse_mode: "HTML"
    });
  });

  bot.command("refresh", async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const currentStatus = getWorkOrderSyncStatus();

    if (currentStatus.isRunning) {
      return ctx.reply(
        `⏳ <b>Sinkronisasi sedang berjalan.</b>

Silakan tunggu hingga proses pembaruan data selesai, lalu coba <code>/refresh</code> lagi.`,
        { parse_mode: "HTML" }
      );
    }

    await ctx.reply(
      `🔄 <b>Memulai refresh data Work Order...</b>

Bot sedang mengambil data terbaru dari Insera. Mohon tunggu.`,
      { parse_mode: "HTML" }
    );

    try {
      const result = await runWorkOrderSync("manual_refresh");

      return ctx.reply(formatSyncResult(result), {
        parse_mode: "HTML"
      });
    } catch (error) {
      console.error("[manual-refresh-error]", error.message);

      return ctx.reply(
        `❌ <b>Refresh data gagal.</b>

${error.message}`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.command("addgroup", (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply(
        `⚠️ Command <code>/addgroup</code> hanya dapat digunakan di dalam grup Telegram.

Masukkan bot ke grup tujuan, lalu ketik <code>/addgroup</code> di grup tersebut.`,
        { parse_mode: "HTML" }
      );
    }

    const chatId = String(ctx.chat.id);
    const chatTitle = ctx.chat.title || "Grup tanpa nama";
    const chatType = ctx.chat.type;

    const addedGroup = registerNotificationGroup({
      chatId,
      chatTitle,
      chatType,
      addedByTelegramId: ctx.from.id,
      addedByName:
        ctx.from.first_name || ctx.from.username || "Pengguna Telegram"
    });

    return ctx.reply(
      `✅ <b>Grup berhasil didaftarkan.</b>

👥 Nama grup: <b>${addedGroup.chat_title}</b>
🆔 ID grup: <code>${addedGroup.chat_id}</code>
📌 Status: <b>Aktif</b>

Grup ini sudah tersimpan sebagai tujuan laporan STARTWORK otomatis.`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("groups", (ctx) => {
    const groups = getActiveNotificationGroups();

    if (groups.length === 0) {
      return ctx.reply(
        "ℹ️ Belum ada grup yang terdaftar untuk menerima laporan."
      );
    }

    const rows = groups.map(
      (group, index) =>
        `${index + 1}. <b>${group.chat_title}</b>
🆔 <code>${group.chat_id}</code>
📌 ${group.chat_type}`
    );

    return ctx.reply(
      `👥 <b>Daftar Grup Terdaftar</b>

${rows.join("\n\n")}`,
      { parse_mode: "HTML" }
    );
  });
}

module.exports = { registerStatusHandler };