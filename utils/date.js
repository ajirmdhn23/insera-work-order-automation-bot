const { timezone } = require("../config/app");

function getWibDate() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: timezone
    })
  );
}

function formatTanggalIndonesia(date = getWibDate()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatWaktuWib(date = getWibDate()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(date)
    .replace(".", ":");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return value;
}

module.exports = {
  getWibDate,
  formatTanggalIndonesia,
  formatWaktuWib,
  formatDateTime
};