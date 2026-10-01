const { db } = require("./connection");

const ALLOWED_INTERVALS = [5, 10, 15, 20];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeInterval(intervalMinutes) {
  const interval = Number(intervalMinutes);

  if (!ALLOWED_INTERVALS.includes(interval)) {
    throw new Error(
      "Interval tidak valid. Gunakan 5, 10, 15, atau 20 menit."
    );
  }

  return interval;
}

function getPersonalSubscription(chatId) {
  return (
    db
      .prepare(`
        SELECT *
        FROM personal_subscriptions
        WHERE chat_id = ?
      `)
      .get(normalizeText(chatId)) || null
  );
}

function savePersonalSubscription({
  chatId,
  telegramUserId,
  telegramUsername,
  serviceAreaCode
}) {
  const now = new Date().toISOString();
  const existing = getPersonalSubscription(chatId);

  db.prepare(`
    INSERT INTO personal_subscriptions (
      chat_id,
      telegram_user_id,
      telegram_username,
      service_area_code,
      notification_interval_minutes,
      notifications_enabled,
      created_at,
      updated_at
    )
    VALUES (
      @chatId,
      @telegramUserId,
      @telegramUsername,
      @serviceAreaCode,
      @notificationIntervalMinutes,
      1,
      @now,
      @now
    )
    ON CONFLICT(chat_id) DO UPDATE SET
      telegram_user_id = excluded.telegram_user_id,
      telegram_username = excluded.telegram_username,
      service_area_code = excluded.service_area_code,
      notifications_enabled = 1,
      updated_at = excluded.updated_at
  `).run({
    chatId: normalizeText(chatId),
    telegramUserId: normalizeText(telegramUserId),
    telegramUsername: normalizeText(telegramUsername) || null,
    serviceAreaCode: normalizeText(serviceAreaCode),
    notificationIntervalMinutes:
      existing?.notification_interval_minutes || 5,
    now
  });

  return getPersonalSubscription(chatId);
}

function setPersonalNotificationInterval(chatId, intervalMinutes) {
  const interval = normalizeInterval(intervalMinutes);
  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE personal_subscriptions
    SET
      notification_interval_minutes = @interval,
      updated_at = @now
    WHERE chat_id = @chatId
  `).run({
    chatId: normalizeText(chatId),
    interval,
    now
  });

  if (result.changes === 0) {
    return null;
  }

  return getPersonalSubscription(chatId);
}

function getActivePersonalSubscriptions() {
  return db.prepare(`
    SELECT *
    FROM personal_subscriptions
    WHERE notifications_enabled = 1
    ORDER BY datetime(created_at) ASC
  `).all();
}

module.exports = {
  ALLOWED_INTERVALS,
  getPersonalSubscription,
  savePersonalSubscription,
  setPersonalNotificationInterval,
  getActivePersonalSubscriptions
};