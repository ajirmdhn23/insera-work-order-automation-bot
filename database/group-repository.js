const { db } = require("./connection");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function registerNotificationGroup({
  chatId,
  chatTitle,
  chatType,
  addedByTelegramId,
  addedByName
}) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notification_groups (
      chat_id,
      chat_title,
      chat_type,
      added_by_telegram_id,
      added_by_name,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      @chatId,
      @chatTitle,
      @chatType,
      @addedByTelegramId,
      @addedByName,
      1,
      @now,
      @now
    )
    ON CONFLICT(chat_id) DO UPDATE SET
      chat_title = excluded.chat_title,
      chat_type = excluded.chat_type,
      added_by_telegram_id = excluded.added_by_telegram_id,
      added_by_name = excluded.added_by_name,
      is_active = 1,
      updated_at = excluded.updated_at
  `).run({
    chatId: normalizeText(chatId),
    chatTitle: normalizeText(chatTitle) || "Grup tanpa nama",
    chatType: normalizeText(chatType),
    addedByTelegramId: normalizeText(addedByTelegramId),
    addedByName: normalizeText(addedByName) || null,
    now
  });

  return getNotificationGroupByChatId(chatId);
}

function getNotificationGroupByChatId(chatId) {
  return (
    db
      .prepare(`
        SELECT *
        FROM notification_groups
        WHERE chat_id = ?
      `)
      .get(normalizeText(chatId)) || null
  );
}

function getActiveNotificationGroups() {
  return db
    .prepare(`
      SELECT *
      FROM notification_groups
      WHERE is_active = 1
      ORDER BY datetime(created_at) ASC
    `)
    .all();
}

function deactivateNotificationGroup(chatId) {
  const now = new Date().toISOString();

  const result = db
    .prepare(`
      UPDATE notification_groups
      SET
        is_active = 0,
        updated_at = @now
      WHERE chat_id = @chatId
    `)
    .run({
      chatId: normalizeText(chatId),
      now
    });

  return result.changes > 0;
}

module.exports = {
  registerNotificationGroup,
  getNotificationGroupByChatId,
  getActiveNotificationGroups,
  deactivateNotificationGroup
};