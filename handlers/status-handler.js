const { dataMode } = require("../config/app");
const { findUserByTelegramId } = require("../database/user-repository");
const { formatTanggalIndonesia, formatWaktuWib } = require("../utils/date");

function registerStatusHandler(bot) {
  bot.command("status", (ctx) => {
    const user = findUserByTelegramId(ctx.from.id);

    if (!user) {
      return ctx.reply(
        "⚠️ Kamu belum terdaftar. Ketik /start lalu tekan tombol 📝 Registrasi."
      );
    }

    return ctx.reply(
      `✅ <b>Bot aktif</b>
🕒 Waktu WIB: ${formatTanggalIndonesia()} ${formatWaktuWib()} WIB
📦 Sumber data WO: <b>${dataMode}</b>
👤 User: ${user.full_name}
🏢 Unit: ${user.work_unit}`,
      { parse_mode: "HTML" }
    );
  });
}

module.exports = { registerStatusHandler };