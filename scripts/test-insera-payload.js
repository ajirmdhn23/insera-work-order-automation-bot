require("dotenv").config();

const {
  buildWorkOrderPayload
} = require("../services/insera-api-service");

const payload = buildWorkOrderPayload({
  page: 1,
  pageSize: 100,
  dateFrom: "2026-09-01",
  dateTo: "2026-09-17"
});

console.log(JSON.stringify(payload, null, 2));