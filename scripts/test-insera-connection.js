require("dotenv").config();

const {
  fetchWorkOrdersFromInsera
} = require("../services/insera-api-service");

async function main() {
  try {
    const result = await fetchWorkOrdersFromInsera({
      page: 1,
      pageSize: 1
    });

    console.log("[insera] berhasil mengambil data");
    console.log({
      recordsTotal: result.recordsTotal,
      recordsFiltered: result.recordsFiltered,
      totalPages: result.totalPages,
      workOrderCount: result.workOrders.length,
      firstWo: result.workOrders[0]?.woNumber || "-"
    });
  } catch (error) {
    console.error("[insera] gagal mengambil data");
    console.error(error.message);
  }
}

main();