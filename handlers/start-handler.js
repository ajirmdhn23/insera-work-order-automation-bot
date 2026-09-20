const { appName } = require("../config/app");
const { findUserByTelegramId } = require("../database/user-repository");
const { showMainMenu } = require("./registration-handler");

function registerStartHandler(bot) {
  bot.start((ctx) => {
    const existingUser = findUserByTelegramId(ctx.from.id);

    if (existingUser) {
      return showMainMenu(ctx, existingUser);
    }

    return ctx.reply(
      `👋 Halo! Selamat datang di <b>${appName}!</b>

Bot ini membantu Anda memantau informasi Work Order secara praktis melalui Telegram. 

Silakan lakukan registrasi untuk melanjutkan dan mengakses layanan Work Order!`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📝 Registrasi",
                callback_data: "START_REGISTRATION"
              }
            ]
          ]
        }
      }
    );
  });
}

module.exports = {
  registerStartHandler
};