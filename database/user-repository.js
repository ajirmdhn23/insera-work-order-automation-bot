const { db } = require("./connection");

function findUserByTelegramId(telegramUserId) {
  return db
    .prepare(
      `
        SELECT *
        FROM bot_users
        WHERE telegram_user_id = ?
          AND is_active = 1
      `
    )
    .get(String(telegramUserId));
}

function findUserByEmployeeId(employeeId) {
  return db
    .prepare(
      `
        SELECT *
        FROM bot_users
        WHERE employee_id = ?
      `
    )
    .get(String(employeeId).trim());
}

function createUser({
  telegramUserId,
  telegramUsername,
  employeeId,
  fullName,
  workUnit,
  phoneNumber
}) {
  const statement = db.prepare(`
    INSERT INTO bot_users (
      telegram_user_id,
      telegram_username,
      employee_id,
      full_name,
      work_unit,
      phone_number
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = statement.run(
    String(telegramUserId),
    telegramUsername || null,
    String(employeeId).trim(),
    String(fullName).trim(),
    String(workUnit).trim(),
    String(phoneNumber).trim()
  );

  return db
    .prepare("SELECT * FROM bot_users WHERE id = ?")
    .get(result.lastInsertRowid);
}

function saveUserLocation({
  telegramUserId,
  latitude,
  longitude
}) {
  db.prepare(
    `
      UPDATE bot_users
      SET
        location_latitude = ?,
        location_longitude = ?,
        location_received_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_user_id = ?
    `
  ).run(latitude, longitude, String(telegramUserId));

  return findUserByTelegramId(telegramUserId);
}

function deleteUserByTelegramId(telegramUserId) {
  return db
    .prepare(
      `
        DELETE FROM bot_users
        WHERE telegram_user_id = ?
      `
    )
    .run(String(telegramUserId));
}

module.exports = {
  findUserByTelegramId,
  findUserByEmployeeId,
  createUser,
  saveUserLocation,
  deleteUserByTelegramId
};