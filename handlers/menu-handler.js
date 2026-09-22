const {
  findUserByTelegramId,
  deleteUserByTelegramId
} = require("../database/user-repository");

const {
  saveWorkOrderSyncInterval
} = require("../database/work-order-repository");

const {
  showWorkOrderReport
} = require("./work-order-handler");

const {
  buildRegistrationRecap
} = require("./registration-handler");

const {
  ALLOWED_INTERVALS,
  runWorkOrderSync,
  setWorkOrderSyncInterval,
  getIntervalLabel,
  getWorkOrderSyncStatus
} = require("../jobs/work-order-sync-job");

const {
  formatTanggalIndonesia,
  formatWaktuWib
} = require("../utils/date");

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

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📋 Laporan Work Order",
          callback_data: "MENU_WORK_ORDER"
        }
      ],
      [
        {
          text: "🔄 Refresh Data",
          callback_data: "MENU_REFRESH_DATA"
        },
        {
          text: "⚙️ Pengaturan Data",
          callback_data: "MENU_SYNC_SETTINGS"
        }
      ],
      [
        {
          text: "👤 Profil Saya",
          callback_data: "MENU_PROFILE"
        },
        {
          text: "❓ Bantuan",
          callback_data: "MENU_HELP"
        }
      ],
      [
        {
          text: "🚪 Keluar",
          callback_data: "MENU_EXIT"
        }
      ]
    ]
  };
}

function serviceAreaKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📍 SA Batu",
          callback_data: "SA_BTU"
        },
        {
          text: "📍 SA Bululawang",
          callback_data: "SA_BLB"
        }
      ],
      [
        {
          text: "📍 SA Klojen",
          callback_data: "SA_KLJ"
        },
        {
          text: "📍 SA Kepanjen",
          callback_data: "SA_KEP"
        }
      ],
      [
        {
          text: "📍 SA Turen",
          callback_data: "SA_TUR"
        },
        {
          text: "📍 SA Malang",
          callback_data: "SA_MLG"
        }
      ],
      [
        {
          text: "📍 SA Sawojajar",
          callback_data: "SA_SWJ"
        },
        {
          text: "📍 SA Blitar",
          callback_data: "SA_BLR"
        }
      ],
      [
        {
          text: "📍 SA Tulungagung",
          callback_data: "SA_TUL"
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

function workOrderLocationMessage() {
  const syncStatus = getWorkOrderSyncStatus();

  return `📋 <b>Laporan Work Order</b>

Pilih wilayah Service Area untuk melihat daftar Work Order.

🔄 Data diperbarui otomatis ${getIntervalLabel(
    syncStatus.intervalMinutes
  )}.
🔎 Setelah daftar muncul, ketik <code>/wo NOMOR_WO</code> untuk melihat detail satu Work Order.`;
}

function mainMenuMessage(user) {
  return `🏠 <b>Menu Utama</b>

Halo, <b>${user.full_name}</b>.
Silakan pilih menu yang tersedia.`;
}

function syncSettingsKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "5 menit",
          callback_data: "SET_SYNC_INTERVAL_5"
        },
        {
          text: "10 menit",
          callback_data: "SET_SYNC_INTERVAL_10"
        }
      ],
      [
        {
          text: "15 menit",
          callback_data: "SET_SYNC_INTERVAL_15"
        },
        {
          text: "30 menit",
          callback_data: "SET_SYNC_INTERVAL_30"
        }
      ],
      [
        {
          text: "1 jam",
          callback_data: "SET_SYNC_INTERVAL_60"
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

function syncSettingsMessage() {
  const syncStatus = getWorkOrderSyncStatus();

  return `⚙️ <b>Pengaturan Sinkronisasi Data</b>

Interval aktif: <b>${getIntervalLabel(
    syncStatus.intervalMinutes
  )}</b>

Pilih interval pembaruan data Work Order dari Insera.

⚠️ Interval yang lebih pendek akan lebih sering mengambil data dari Insera.`;
}

function formatRefreshResult(result) {
  if (result.skipped) {
    return `⏳ <b>Sinkronisasi sedang berjalan.</b>

Refresh tidak dijalankan karena proses pembaruan data sebelumnya belum selesai.`;
  }

  const updatedAt = new Date(result.lastSyncedAt);

  const updatedLabel = Number.isNaN(updatedAt.getTime())
    ? "Belum tersedia"
    : `${formatTanggalIndonesia(updatedAt)} ${formatWaktuWib(
        updatedAt
      )} WIB`;

  return `✅ <b>Refresh data berhasil.</b>

📥 Data diambil dari Insera: <b>${result.totalFetched}</b>
💾 Work Order disimpan: <b>${result.totalSaved}</b>
🕒 Pembaruan terakhir: <b>${updatedLabel}</b>`;
}

function sendMainMenu(ctx, user) {
  return ctx.reply(mainMenuMessage(user), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard()
  });
}

function showWorkOrderLocationMenu(ctx) {
  return ctx.reply(workOrderLocationMessage(), {
    parse_mode: "HTML",
    reply_markup: serviceAreaKeyboard()
  });
}

function editWorkOrderLocationMenu(ctx) {
  return ctx.editMessageText(workOrderLocationMessage(), {
    parse_mode: "HTML",
    reply_markup: serviceAreaKeyboard()
  });
}

function showExitConfirmation(ctx) {
  const user = requireRegisteredUser(ctx);

  if (!user) {
    return;
  }

  return ctx.reply(
    `⚠️ <b>Konfirmasi Keluar</b>

Jika dilanjutkan, data registrasi kamu akan dihapus dari bot:

👤 ${user.full_name}
🆔 <code>${user.employee_id}</code>
🏢 ${user.work_unit}

Setelah data dihapus, saat mengetik <code>/start</code> kamu akan diarahkan ke form registrasi dari awal.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Ya, Hapus Data Saya",
              callback_data: "DELETE_MY_REGISTRATION"
            }
          ],
          [
            {
              text: "↩️ Batal",
              callback_data: "CANCEL_DELETE_REGISTRATION"
            }
          ]
        ]
      }
    }
  );
}

function showHelp(ctx, user) {
  const syncStatus = getWorkOrderSyncStatus();

  return ctx.reply(
    `❓ <b>Pusat Bantuan — Automasi WO Insera</b>

Bot ini digunakan untuk melihat Work Order Insera, memantau STARTWORK, memperbarui data, dan menerima notifikasi perubahan WO.

<b>Fitur Utama</b>
📋 <b>Laporan Work Order</b> — pilih Service Area untuk melihat daftar WO.
🔎 <b>Detail Work Order</b> — lihat informasi lengkap berdasarkan nomor WO.
🚨 <b>Monitoring STARTWORK</b> — lihat daftar WO berstatus STARTWORK.
🔄 <b>Refresh Data</b> — ambil data terbaru dari Insera secara manual.
⚙️ <b>Pengaturan Data</b> — atur pembaruan otomatis; saat ini <b>${getIntervalLabel(
      syncStatus.intervalMinutes
    )}</b>.
📊 <b>Status Bot</b> — cek sync terakhir, cache, database, dan kondisi bot.
📢 <b>Notifikasi Grup</b> — kirim perubahan STARTWORK ke grup yang terdaftar.
👤 <b>Profil Saya</b> — lihat data registrasi akun.
🚪 <b>Keluar</b> — hapus data registrasi setelah konfirmasi.

<b>Command</b>
<code>/start</code> — buka menu utama
<code>/wo NOMOR_WO</code> — detail WO, contoh: <code>/wo W0064783278</code>
<code>/sc</code> — daftar STARTWORK
<code>/refresh</code> — refresh data Work Order
<code>/status</code> — dashboard status bot
<code>/addgroup</code> — daftarkan grup notifikasi
<code>/groups</code> — lihat grup notifikasi aktif
<code>/batal</code> — batalkan proses registrasi

<b>Catatan</b>
Jika refresh atau sync menampilkan timeout, bot tetap aktif. Itu berarti API Insera sedang lambat/tidak merespons; coba kembali beberapa saat kemudian atau cek <code>/status</code>.

━━━━━━━━━━━━━━━━━━━━
👤 <b>${user.full_name}</b> • ${user.work_unit}`,
    {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard()
    }
  );
}
function registerMenuHandler(bot) {
  bot.action("MENU_WORK_ORDER", async (ctx) => {
    await ctx.answerCbQuery();

    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const currentMessageText = String(
      ctx.callbackQuery?.message?.text || ""
    );

    const isWorkOrderPage = currentMessageText.includes(
      "Laporan Work Order"
    );

    if (isWorkOrderPage) {
      return editWorkOrderLocationMenu(ctx);
    }

    return showWorkOrderLocationMenu(ctx);
  });

  bot.action("MENU_REFRESH_DATA", async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return ctx.answerCbQuery();
    }

    const syncStatus = getWorkOrderSyncStatus();

    if (syncStatus.isRunning) {
      return ctx.answerCbQuery(
        "Sinkronisasi sedang berjalan. Tunggu hingga selesai.",
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery("Memulai refresh data...");

    await ctx.reply(
      `🔄 <b>Memulai refresh data Work Order...</b>

Bot sedang mengambil data terbaru dari Insera. Mohon tunggu.`,
      { parse_mode: "HTML" }
    );

    try {
      const result = await runWorkOrderSync("manual_refresh_button");

      return ctx.reply(formatRefreshResult(result), {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard()
      });
    } catch (error) {
      console.error("[menu-refresh-error]", error.message);

      return ctx.reply(
        `❌ <b>Refresh data gagal.</b>

${error.message}`,
        {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard()
        }
      );
    }
  });

  bot.action("MENU_SYNC_SETTINGS", async (ctx) => {
    await ctx.answerCbQuery();

    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return ctx.editMessageText(syncSettingsMessage(), {
      parse_mode: "HTML",
      reply_markup: syncSettingsKeyboard()
    });
  });

  bot.action(/^SET_SYNC_INTERVAL_(5|10|15|30|60)$/, async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const intervalMinutes = Number(ctx.match[1]);

    if (!ALLOWED_INTERVALS.includes(intervalMinutes)) {
      return ctx.answerCbQuery("Interval tidak valid.", {
        show_alert: true
      });
    }

    try {
      saveWorkOrderSyncInterval(intervalMinutes);
      setWorkOrderSyncInterval(intervalMinutes);

      await ctx.answerCbQuery(
        `Interval diubah menjadi ${getIntervalLabel(intervalMinutes)}.`
      );

      return ctx.editMessageText(
        `✅ <b>Interval sinkronisasi berhasil diubah.</b>

Data Work Order sekarang diperbarui otomatis <b>${getIntervalLabel(
          intervalMinutes
        )}</b>.

Pengaturan ini tersimpan meskipun bot direstart.`,
        {
          parse_mode: "HTML",
          reply_markup: syncSettingsKeyboard()
        }
      );
    } catch (error) {
      console.error("[set-sync-interval-error]", error.message);

      return ctx.answerCbQuery(
        "Interval gagal diubah. Silakan coba lagi.",
        {
          show_alert: true
        }
      );
    }
  });

  bot.action(
    /^SA_(BTU|BLB|KLJ|KEP|TUR|MLG|SWJ|BLR|TUL)$/,
    async (ctx) => {
      await ctx.answerCbQuery();

      const user = requireRegisteredUser(ctx);

      if (!user) {
        return;
      }

      return showWorkOrderReport(ctx, ctx.match[0], 1, true);
    }
  );

  bot.action("MENU_PROFILE", async (ctx) => {
    await ctx.answerCbQuery();

    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return ctx.reply(buildRegistrationRecap(user), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: mainMenuKeyboard()
    });
  });

  bot.action("MENU_HELP", async (ctx) => {
    await ctx.answerCbQuery();

    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return showHelp(ctx, user);
  });

  bot.action("MENU_EXIT", async (ctx) => {
    await ctx.answerCbQuery();
    return showExitConfirmation(ctx);
  });

  bot.action("BACK_TO_MAIN_MENU", async (ctx) => {
    await ctx.answerCbQuery();

    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return ctx.editMessageText(mainMenuMessage(user), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard()
    });
  });

  bot.action("DELETE_MY_REGISTRATION", async (ctx) => {
    await ctx.answerCbQuery();

    const user = findUserByTelegramId(ctx.from.id);

    if (!user) {
      return ctx.editMessageText(
        "ℹ️ Data registrasi kamu sudah tidak ditemukan. Ketik /start untuk registrasi."
      );
    }

    try {
      deleteUserByTelegramId(ctx.from.id);

      return ctx.editMessageText(
        `✅ <b>Data registrasi berhasil dihapus.</b>

Kamu telah keluar dari sistem bot.

Saat ingin menggunakan bot lagi, kirim <code>/start</code> dan isi form registrasi dari awal.`,
        {
          parse_mode: "HTML"
        }
      );
    } catch (error) {
      console.error("[delete-user-error]", error.message);

      return ctx.answerCbQuery(
        "Data registrasi gagal dihapus. Silakan coba kembali.",
        { show_alert: true }
      );
    }
  });

  bot.action("CANCEL_DELETE_REGISTRATION", async (ctx) => {
    await ctx.answerCbQuery("Penghapusan dibatalkan.");

    const user = findUserByTelegramId(ctx.from.id);

    if (!user) {
      return ctx.editMessageText(
        "ℹ️ Tidak ada data registrasi aktif. Ketik /start untuk memulai."
      );
    }

    return ctx.editMessageText(
      "✅ Penghapusan dibatalkan. Data registrasi kamu tetap tersimpan.",
      {
        reply_markup: mainMenuKeyboard()
      }
    );
  });

  bot.hears("📋 Laporan Work Order", (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return showWorkOrderLocationMenu(ctx);
  });

  bot.hears("🔄 Refresh Data", async (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    const syncStatus = getWorkOrderSyncStatus();

    if (syncStatus.isRunning) {
      return ctx.reply(
        "⏳ Sinkronisasi sedang berjalan. Tunggu hingga selesai."
      );
    }

    await ctx.reply(
      "🔄 Memulai refresh data Work Order dari Insera. Mohon tunggu."
    );

    try {
      const result = await runWorkOrderSync("manual_refresh_button");

      return ctx.reply(formatRefreshResult(result), {
        parse_mode: "HTML",
        reply_markup: mainMenuKeyboard()
      });
    } catch (error) {
      console.error("[menu-refresh-hears-error]", error.message);

      return ctx.reply(`❌ Refresh data gagal.\n\n${error.message}`);
    }
  });

  bot.hears("👤 Profil Saya", (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return ctx.reply(buildRegistrationRecap(user), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: mainMenuKeyboard()
    });
  });

  bot.hears("❓ Bantuan", (ctx) => {
    const user = requireRegisteredUser(ctx);

    if (!user) {
      return;
    }

    return showHelp(ctx, user);
  });

  bot.hears("🚪 Keluar", (ctx) => {
    return showExitConfirmation(ctx);
  });
}

module.exports = {
  registerMenuHandler
};