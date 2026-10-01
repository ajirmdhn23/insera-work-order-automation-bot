function serviceAreaKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📍 SA Batu",
          callback_data: "SA_BTU"
        },
        {
          text: "📍 SA Blimbing",
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
          text: "🧩 Pilih Layanan",
          callback_data: "SERVICE_MENU"
        }
      ],
      [
        {
          text: "❓ Bantuan",
          callback_data: "HELP_MENU"
        }
      ]
    ]
  };
}

function startMessage() {
  return `📋 <b>Laporan Work Order Insera</b>

Pilih Service Area untuk melihat daftar Work Order berstatus <b>STARTWORK</b>.

⏱ Data diperbarui otomatis setiap 5 menit.

Atau pilih <b>🧩 Pilih Layanan</b> untuk melihat laporan berdasarkan kategori layanan.`;
}

function registerStartHandler(bot) {
  bot.start(async (ctx) => {
    return ctx.reply(startMessage(), {
      parse_mode: "HTML",
      reply_markup: serviceAreaKeyboard()
    });
  });
}

module.exports = {
  registerStartHandler,
  serviceAreaKeyboard,
  startMessage
};