const {
  findUserByTelegramId,
  findUserByEmployeeId,
  createUser,
  saveUserLocation
} = require("../database/user-repository");

const registrationSessions = new Map();

function formatDateWib(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const normalizedDateValue = String(dateValue).endsWith("Z")
    ? dateValue
    : `${dateValue}Z`;

  const date = new Date(normalizedDateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium"
  }).format(date);
}

function getLocationText(user, emptyText = "Belum dibagikan") {
  if (
    user.location_latitude === null ||
    user.location_latitude === undefined ||
    user.location_longitude === null ||
    user.location_longitude === undefined
  ) {
    return emptyText;
  }

  const latitude = Number(user.location_latitude).toFixed(6);
  const longitude = Number(user.location_longitude).toFixed(6);
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return `<a href="${mapUrl}">Lihat lokasi di peta</a>
  
🕒 Dikirim: ${formatDateWib(user.location_received_at)}`;
}

function buildRegistrationRecap(
  user,
  locationEmptyText = "Belum dibagikan"
) {
  return `✅ <b>Registrasi Berhasil</b>
━━━━━━━━━━━━━━━━━━━━

👤 <b>Nama Lengkap :</b>
${user.full_name}

🆔 <b>ID Pegawai :</b>
<code>${user.employee_id}</code>

🏢 <b>Unit / Area Kerja :</b>
${user.work_unit}

📱 <b>Nomor HP :</b>
<code>${user.phone_number || "-"}</code>

🕒 <b>Waktu Pengisian :</b>
${formatDateWib(user.registered_at)}

📍 <b>Lokasi Pengisian :</b>
${getLocationText(user, locationEmptyText)}`;
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

function locationReplyKeyboard() {
  return {
    keyboard: [
      [
        {
          text: "📍 Bagikan Lokasi",
          request_location: true
        }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

function removeReplyKeyboard() {
  return {
    remove_keyboard: true
  };
}

function showMainMenu(ctx, user, removeLocationKeyboard = false) {
  const replyMarkup = removeLocationKeyboard
    ? {
        ...mainMenuKeyboard(),
        ...removeReplyKeyboard()
      }
    : mainMenuKeyboard();

  return ctx.reply(
    `${buildRegistrationRecap(user)}

━━━━━━━━━━━━━━━━━━━━
Silakan pilih menu yang tersedia.`,
    {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup
    }
  );
}

function normalizeLabel(label) {
  return label
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseRegistrationForm(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const data = {};

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const label = normalizeLabel(line.slice(0, separatorIndex));
    const value = line.slice(separatorIndex + 1).trim();

    if (label === "nama lengkap" || label === "nama") {
      data.fullName = value;
    }

    if (
      label === "nik / id pegawai" ||
      label === "nik/id pegawai" ||
      label === "id pegawai" ||
      label === "nik"
    ) {
      data.employeeId = value;
    }

    if (
      label === "unit / area kerja" ||
      label === "unit/area kerja" ||
      label === "unit kerja" ||
      label === "area kerja"
    ) {
      data.workUnit = value;
    }

    if (
      label === "nomor hp" ||
      label === "no hp" ||
      label === "no. hp" ||
      label === "telepon" ||
      label === "nomor telepon"
    ) {
      data.phoneNumber = value;
    }
  }

  return data;
}

function isValidPhoneNumber(phoneNumber) {
  return /^[0-9+\-\s()]{8,20}$/.test(phoneNumber);
}

async function showRegistrationForm(ctx) {
  const formMessage = await ctx.reply(
    `📝 <b>Form Registrasi Pengguna</b>

Lengkapi seluruh data pada formulir berikut, kemudian kirimkan dalam <b>satu pesan!</b>
<pre>Nama Lengkap :
ID Pegawai :
Unit / Area Kerja :
Nomor HP :</pre>

Ketik <code>/batal</code> untuk membatalkan.`,
    { parse_mode: "HTML" }
  );

  registrationSessions.set(ctx.from.id, {
    step: "FORM",
    formMessageId: formMessage.message_id
  });

  return formMessage;
}

async function deleteRegistrationForm(ctx, session) {
  const chatId = ctx.chat?.id || ctx.from?.id;
  const messageId = session?.formMessageId;

  if (!chatId || !messageId) {
    return;
  }

  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
  } catch (error) {
    console.warn(
      "[delete-registration-form-warning]",
      error.message
    );
  }
}

async function deleteRegistrationRecap(ctx, session) {
  const chatId = ctx.chat?.id || ctx.from?.id;
  const messageId = session?.registrationRecapMessageId;

  if (!chatId || !messageId) {
    return;
  }

  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
  } catch (error) {
    console.warn(
      "[delete-registration-recap-warning]",
      error.message
    );
  }
}

function registerRegistrationHandler(bot) {
  bot.action("START_REGISTRATION", async (ctx) => {
    await ctx.answerCbQuery();

    const existingUser = findUserByTelegramId(ctx.from.id);

    if (existingUser) {
      return showMainMenu(ctx, existingUser);
    }

    return showRegistrationForm(ctx);
  });

  bot.hears("📝 Registrasi", async (ctx) => {
    const existingUser = findUserByTelegramId(ctx.from.id);

    if (existingUser) {
      return showMainMenu(ctx, existingUser);
    }

    return showRegistrationForm(ctx);
  });

  bot.command("batal", async (ctx) => {
    const session = registrationSessions.get(ctx.from.id);

    await deleteRegistrationForm(ctx, session);

    registrationSessions.delete(ctx.from.id);

    return ctx.reply(
      "❌ Registrasi dibatalkan. Ketik /start untuk memulai kembali.",
      {
        reply_markup: removeReplyKeyboard()
      }
    );
  });

  bot.on("text", async (ctx, next) => {
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return next();
    }

    const session = registrationSessions.get(ctx.from.id);

    if (!session || session.step !== "FORM") {
      return next();
    }

    const formData = parseRegistrationForm(text);

    if (
      !formData.fullName ||
      !formData.employeeId ||
      !formData.workUnit ||
      !formData.phoneNumber
    ) {
      return ctx.reply(
        `⚠️ Format belum lengkap.

Pastikan empat bagian ini ada dan memiliki isi:

<pre>Nama Lengkap :
ID Pegawai :
Unit / Area Kerja :
Nomor HP :</pre>`,
        { parse_mode: "HTML" }
      );
    }

    if (
      formData.fullName.length < 3 ||
      formData.fullName.length > 100
    ) {
      return ctx.reply(
        "⚠️ Nama lengkap harus berisi 3–100 karakter."
      );
    }

    if (
      formData.employeeId.length < 3 ||
      formData.employeeId.length > 30
    ) {
      return ctx.reply(
        "⚠️ ID Pegawai harus berisi 3–30 karakter."
      );
    }

    if (
      formData.workUnit.length < 2 ||
      formData.workUnit.length > 100
    ) {
      return ctx.reply(
        "⚠️ Unit / area kerja harus berisi 2–100 karakter."
      );
    }

    if (!isValidPhoneNumber(formData.phoneNumber)) {
      return ctx.reply(
        "⚠️ Nomor HP tidak valid. Masukkan nomor HP dengan panjang 8–20 karakter."
      );
    }

    const existingEmployee = findUserByEmployeeId(
      formData.employeeId
    );

    if (existingEmployee) {
      return ctx.reply(
        "⚠️ ID Pegawai tersebut sudah digunakan. Gunakan ID lain."
      );
    }

    try {
      const user = createUser({
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username,
        employeeId: formData.employeeId,
        fullName: formData.fullName,
        workUnit: formData.workUnit,
        phoneNumber: formData.phoneNumber
      });

      await deleteRegistrationForm(ctx, session);

      const registrationRecapMessage = await ctx.reply(
        buildRegistrationRecap(user),
        {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: locationReplyKeyboard()
        }
      );

      registrationSessions.set(ctx.from.id, {
        step: "LOCATION",
        userId: user.id,
        registrationRecapMessageId:
          registrationRecapMessage.message_id
      });
    } catch (error) {
      console.error("[registration-error]", error.message);
      registrationSessions.delete(ctx.from.id);

      return ctx.reply(
        "❌ Registrasi gagal disimpan. Silakan ketik /start dan coba lagi."
      );
    }
  });

  bot.on("location", async (ctx) => {
    const session = registrationSessions.get(ctx.from.id);

    if (!session || session.step !== "LOCATION") {
      return ctx.reply(
        "ℹ️ Lokasi diterima, tetapi tidak ada proses registrasi yang sedang berlangsung."
      );
    }

    try {
      const user = saveUserLocation({
        telegramUserId: ctx.from.id,
        latitude: ctx.message.location.latitude,
        longitude: ctx.message.location.longitude
      });

      await deleteRegistrationRecap(ctx, session);

      registrationSessions.delete(ctx.from.id);

      return showMainMenu(ctx, user, true);
    } catch (error) {
      console.error("[location-error]", error.message);

      return ctx.reply(
        "❌ Lokasi gagal disimpan. Silakan coba kirim lokasi kembali."
      );
    }
  });
}

module.exports = {
  registerRegistrationHandler,
  showMainMenu,
  buildRegistrationRecap
};