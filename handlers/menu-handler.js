const {
  getPersonalSubscription,
  savePersonalSubscription,
  setPersonalNotificationInterval
} = require("../database/subscription-repository");

const {
  getServiceAreaByCode
} = require("../services/work-order-service");

const {
  serviceAreaKeyboard,
  startMessage
} = require("./start-handler");

const {
  showPersonalStartworkReport
} = require("./work-order-handler");

const SERVICE_OPTIONS = {
  INDIHOME: {
    label: "🏠 IndiHome",
    description:
      "Layanan internet dan digital untuk kebutuhan rumah."
  },
  INDIBIZ: {
    label: "🏢 IndiBiz",
    description:
      "Layanan konektivitas dan digital untuk kebutuhan bisnis."
  },
  DATIN: {
    label: "🗂️ DATIN",
    description:
      "Layanan Data dan Internet untuk kebutuhan institusi."
  }
};

function getChatId(ctx) {
  return ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || null;
}

function isPrivateChat(ctx) {
  return ctx.chat?.type === "private";
}

function getIntervalLabel(intervalMinutes) {
  return `setiap ${Number(intervalMinutes)} menit`;
}

function intervalKeyboard(selectedInterval) {
  return {
    inline_keyboard: [
      [
        {
          text: `${selectedInterval === 5 ? "✅ " : ""}5 menit`,
          callback_data: "PERSONAL_INTERVAL_5"
        },
        {
          text: `${selectedInterval === 10 ? "✅ " : ""}10 menit`,
          callback_data: "PERSONAL_INTERVAL_10"
        }
      ],
      [
        {
          text: `${selectedInterval === 15 ? "✅ " : ""}15 menit`,
          callback_data: "PERSONAL_INTERVAL_15"
        },
        {
          text: `${selectedInterval === 20 ? "✅ " : ""}20 menit`,
          callback_data: "PERSONAL_INTERVAL_20"
        }
      ],
      [
        {
          text: "⬅️ Kembali ke Laporan",
          callback_data: "PERSONAL_BACK_TO_REPORT"
        }
      ]
    ]
  };
}

function intervalMessage(subscription) {
  const serviceArea = getServiceAreaByCode(
    subscription.service_area_code
  );

  return `⏰ <b>Atur Interval Notifikasi</b>

Service Area: <b>${serviceArea?.name || "Wilayah tidak diketahui"}</b>
Interval saat ini: <b>${getIntervalLabel(
    subscription.notification_interval_minutes
  )}</b>

Pilih interval pembaruan STARTWORK.`;
}

function serviceMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🏠 IndiHome",
          callback_data: "SERVICE_INDIHOME"
        },
        {
          text: "🏢 IndiBiz",
          callback_data: "SERVICE_INDIBIZ"
        }
      ],
      [
        {
          text: "🗂️ DATIN",
          callback_data: "SERVICE_DATIN"
        }
      ],
      [
        {
          text: "❓ Bantuan",
          callback_data: "HELP_MENU"
        }
      ],
      [
        {
          text: "⬅️ Kembali ke daftar SA",
          callback_data: "BACK_TO_MAIN_MENU"
        }
      ]
    ]
  };
}

function serviceMenuMessage() {
  return `🧩 <b>Pilih Layanan</b>

Pilih kategori layanan untuk melihat informasi Work Order berdasarkan layanan.

🏠 <b>IndiHome</b>
Layanan internet dan digital untuk kebutuhan rumah.

🏢 <b>IndiBiz</b>
Layanan konektivitas dan digital untuk kebutuhan bisnis.

🗂️ <b>DATIN</b>
Layanan Data dan Internet untuk kebutuhan institusi.`;
}

function helpKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🧩 Pilih Layanan",
          callback_data: "SERVICE_MENU"
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

function helpMessage() {
  return `❓ <b>Bantuan Bot Automasi WO Insera</b>

Bot ini menampilkan Work Order dengan status <b>STARTWORK</b> dari Insera/WFM.

📍 <b>Pilih Service Area</b>
Tekan nama SA untuk melihat seluruh STARTWORK pada wilayah tersebut.

🧩 <b>Pilih Layanan</b>
Pilih IndiHome, IndiBiz, atau DATIN untuk masuk ke menu kategori layanan.

🔎 <b>Detail Work Order</b>
Gunakan perintah:
<code>/startwork NOMOR_WO</code>

Contoh:
<code>/startwork WO065352165</code>

⏱ Data diperbarui otomatis setiap 5 menit.`;
}

function serviceSelectedKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🧩 Ganti Layanan",
          callback_data: "SERVICE_MENU"
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

function serviceSelectedMessage(serviceKey) {
  const service = SERVICE_OPTIONS[serviceKey];

  return `${service?.label || "🧩 Layanan"} <b>dipilih</b>

${service?.description || ""}

Fitur filter laporan per layanan sedang disiapkan.
Untuk melihat laporan STARTWORK saat ini, silakan kembali ke Menu Utama lalu pilih Service Area.`;
}

async function editMessageSafely(ctx, text, extra) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (error) {
    const message = error?.description || error?.message || "";

    if (message.includes("message is not modified")) {
      return null;
    }

    throw error;
  }
}

function showAreaSelection(ctx) {
  return editMessageSafely(ctx, startMessage(), {
    parse_mode: "HTML",
    reply_markup: serviceAreaKeyboard()
  });
}

function registerMenuHandler(bot) {
  bot.action("SERVICE_MENU", async (ctx) => {
    await ctx.answerCbQuery();

    return editMessageSafely(ctx, serviceMenuMessage(), {
      parse_mode: "HTML",
      reply_markup: serviceMenuKeyboard()
    });
  });

  bot.action("HELP_MENU", async (ctx) => {
    await ctx.answerCbQuery();

    return editMessageSafely(ctx, helpMessage(), {
      parse_mode: "HTML",
      reply_markup: helpKeyboard()
    });
  });

  bot.action("BACK_TO_MAIN_MENU", async (ctx) => {
    await ctx.answerCbQuery();

    return showAreaSelection(ctx);
  });

  bot.action(/^SERVICE_(INDIHOME|INDIBIZ|DATIN)$/, async (ctx) => {
    const serviceKey = ctx.match[1];

    await ctx.answerCbQuery(
      `${SERVICE_OPTIONS[serviceKey].label.replace(/^[^ ]+ /, "")} dipilih.`
    );

    return editMessageSafely(ctx, serviceSelectedMessage(serviceKey), {
      parse_mode: "HTML",
      reply_markup: serviceSelectedKeyboard()
    });
  });

  bot.action(/^SA_(BTU|BLB|KLJ|KEP|TUR|MLG|SWJ|BLR|TUL)$/, async (ctx) => {
    if (!isPrivateChat(ctx)) {
      return ctx.answerCbQuery(
        "Pilih Service Area melalui chat pribadi dengan bot.",
        { show_alert: true }
      );
    }

    const serviceAreaCode = ctx.match[0];
    const serviceArea = getServiceAreaByCode(serviceAreaCode);

    if (!serviceArea) {
      return ctx.answerCbQuery("Service Area tidak ditemukan.", {
        show_alert: true
      });
    }

    savePersonalSubscription({
      chatId: getChatId(ctx),
      telegramUserId: ctx.from.id,
      telegramUsername: ctx.from.username,
      serviceAreaCode
    });

    await ctx.answerCbQuery(`${serviceArea.name} dipilih.`);

    return showPersonalStartworkReport(ctx, serviceAreaCode, 1, true);
  });

  bot.action("PERSONAL_CHANGE_AREA", async (ctx) => {
    await ctx.answerCbQuery("Pilih Service Area baru.");

    return showAreaSelection(ctx);
  });

  bot.action("PERSONAL_INTERVAL_MENU", async (ctx) => {
    const subscription = getPersonalSubscription(getChatId(ctx));

    if (!subscription) {
      await ctx.answerCbQuery(
        "Pilih Service Area terlebih dahulu.",
        { show_alert: true }
      );

      return showAreaSelection(ctx);
    }

    await ctx.answerCbQuery();

    return editMessageSafely(ctx, intervalMessage(subscription), {
      parse_mode: "HTML",
      reply_markup: intervalKeyboard(
        Number(subscription.notification_interval_minutes)
      )
    });
  });

  bot.action(/^PERSONAL_INTERVAL_(5|10|15|20)$/, async (ctx) => {
    const intervalMinutes = Number(ctx.match[1]);

    const subscription = setPersonalNotificationInterval(
      getChatId(ctx),
      intervalMinutes
    );

    if (!subscription) {
      await ctx.answerCbQuery(
        "Pilih Service Area terlebih dahulu.",
        { show_alert: true }
      );

      return showAreaSelection(ctx);
    }

    await ctx.answerCbQuery(
      `Interval diubah menjadi ${getIntervalLabel(intervalMinutes)}.`
    );

    return editMessageSafely(ctx, intervalMessage(subscription), {
      parse_mode: "HTML",
      reply_markup: intervalKeyboard(intervalMinutes)
    });
  });

  bot.action("PERSONAL_BACK_TO_REPORT", async (ctx) => {
    const subscription = getPersonalSubscription(getChatId(ctx));

    if (!subscription) {
      await ctx.answerCbQuery(
        "Pilih Service Area terlebih dahulu.",
        { show_alert: true }
      );

      return showAreaSelection(ctx);
    }

    await ctx.answerCbQuery();

    return showPersonalStartworkReport(
      ctx,
      subscription.service_area_code,
      1,
      true
    );
  });
}

module.exports = {
  registerMenuHandler,
  getIntervalLabel
};