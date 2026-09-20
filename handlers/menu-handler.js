const {
  findUserByTelegramId,
  deleteUserByTelegramId
} = require("../database/user-repository");

const {
  showWorkOrderReport
} = require("./work-order-handler");

const { buildRegistrationRecap } = require("./registration-handler");

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
  return `📋 <b>Laporan Work Order</b>

Pilih wilayah Service Area untuk melihat daftar Work Order.

🔄 Data diperbarui otomatis setiap 1 jam.
🔎 Setelah daftar muncul, ketik <code>/wo NOMOR_WO</code> untuk melihat detail satu Work Order.`;
}

function mainMenuMessage(user) {
  return `🏠 <b>Menu Utama</b>

Halo, <b>${user.full_name}</b>.
Silakan pilih menu yang tersedia.`;
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
  return ctx.reply(
    `❓ <b>Bantuan Automasi WO Insera</b>
━━━━━━━━━━━━━━━━━━━━

👤 <b>Profil Saya</b>
Menampilkan data registrasi, waktu pengisian, serta lokasi yang telah dibagikan.

📋 <b>Laporan Work Order</b>
Pilih menu <b>📋 Laporan Work Order</b>, lalu pilih wilayah Service Area untuk melihat daftar Work Order.

Daftar menampilkan maksimal <b>10 Work Order</b> per halaman. Gunakan tombol <b>Sebelumnya</b> atau <b>Berikutnya</b> untuk berpindah halaman.

📍 <b>Pilih Wilayah Lain</b>
Gunakan tombol ini untuk kembali ke daftar Service Area dan memilih wilayah lain. Tampilan daftar akan diperbarui pada bubble yang sama agar chat tidak menumpuk.

🔎 <b>Detail Work Order</b>
Salin nomor WO dari daftar, kemudian kirim command berikut:

<code>/wo NOMOR_WO</code>

Contoh:

<code>/wo WO064XXXXXX</code>

🔄 <b>Pembaruan Data</b>
Data Work Order diperbarui otomatis setiap 1 jam. Waktu pembaruan terakhir ditampilkan pada laporan dan detail Work Order.

📌 <b>Wilayah Service Area</b>
• SA Batu: BTU, NTG, KPO
• SA Bululawang: BLB
• SA Klojen: KLJ
• SA Kepanjen: KEP, PGK, SBP, GKW, DNO, GDG
• SA Turen: DPT, SBM, APG, TUR, BNR, GDI
• SA Malang: MLG, SWJ, BRG
• SA Sawojajar: PKS, TMP, LWG, SGS
• SA Blitar: BLR, SNT, PAN, BNU, KBN, LDY, WGI
• SA Tulungagung: CAT, KWR, NGU, TUL

🚪 <b>Keluar</b>
Menghapus data registrasi setelah konfirmasi. Jika ingin menggunakan bot lagi, kirim <code>/start</code> dan lakukan registrasi ulang.

<b>Command tersedia</b>
<code>/start</code> — membuka bot atau menu utama
<code>/wo NOMOR_WO</code> — melihat detail Work Order
<code>/status</code> — melihat status bot
<code>/batal</code> — membatalkan proses registrasi

━━━━━━━━━━━━━━━━━━━━
👤 User aktif: <b>${user.full_name}</b>`,
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

  bot.action(
    /^SA_(BTU|BLB|KLJ|KEP|TUR|MLG|SWJ|BLR|TUL)$/,
    async (ctx) => {
      await ctx.answerCbQuery();

      const user = requireRegisteredUser(ctx);

      if (!user) {
        return;
      }

      return showWorkOrderReport(
        ctx,
        ctx.match[0],
        1,
        true
      );
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