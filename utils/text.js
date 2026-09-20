function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function statusIcon(status) {
  const icons = {
    STARTWORK: "🟡",
    OPEN: "🔵",
    ONPROGRESS: "🟠",
    COMPLETED: "🟢",
    CANCELLED: "🔴"
  };

  return icons[String(status).toUpperCase()] || "⚪";
}

function priorityIcon(priority) {
  const icons = {
    LOW: "🟢",
    NORMAL: "🔵",
    HIGH: "🟠",
    URGENT: "🔴"
  };

  return icons[String(priority).toUpperCase()] || "⚪";
}

module.exports = {
  escapeHtml,
  statusIcon,
  priorityIcon
};