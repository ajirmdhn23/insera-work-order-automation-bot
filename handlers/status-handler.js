const { appName } = require("../config/app");

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
      ]
    ]
  };
}

function startMessage() {
  return `📋 <b>${appName}</b>

Pilih Service Area kamu terlebih dahulu.

Setelah dipilih, bot hanya akan menampilkan Work Order berstatus <b>STARTWORK</b> dari wilayah tersebut.`;
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