const cron = require("node-cron");

const {
  syncWorkOrdersFromInsera,
  getAllWorkOrders
} = require("../services/work-order-service");

const {
  getSavedWorkOrderSyncInterval
} = require("../database/work-order-repository");

const {
  detectStartworkChanges,
  replaceStartworkSnapshot
} = require("../database/startwork-snapshot-repository");

const ALLOWED_INTERVALS = [5, 10, 15, 30, 60];

let isSyncRunning = false;
let syncTask = null;
let notificationHandler = null;

let syncStatus = {
  isRunning: false,
  intervalMinutes: 60,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastResult: null,
  lastError: null
};

function getDefaultSyncIntervalMinutes() {
  const configuredInterval = Number(
    process.env.WORK_ORDER_SYNC_INTERVAL_MINUTES
  );

  if (ALLOWED_INTERVALS.includes(configuredInterval)) {
    return configuredInterval;
  }

  return 60;
}

function getInitialSyncIntervalMinutes() {
  const savedInterval = getSavedWorkOrderSyncInterval();

  if (ALLOWED_INTERVALS.includes(savedInterval)) {
    return savedInterval;
  }

  return getDefaultSyncIntervalMinutes();
}

function isAllowedInterval(intervalMinutes) {
  return ALLOWED_INTERVALS.includes(Number(intervalMinutes));
}

function getCronExpression(intervalMinutes) {
  const interval = Number(intervalMinutes);

  if (interval === 60) {
    return "0 * * * *";
  }

  return `*/${interval} * * * *`;
}

function getIntervalLabel(intervalMinutes) {
  const interval = Number(intervalMinutes);

  if (interval === 60) {
    return "setiap 1 jam";
  }

  return `setiap ${interval} menit`;
}

function getWorkOrderSyncStatus() {
  return {
    ...syncStatus,
    isRunning: isSyncRunning
  };
}

function setStartworkNotificationHandler(handler) {
  notificationHandler =
    typeof handler === "function" ? handler : null;
}

async function notifyStartworkChanges(changes, syncResult, trigger) {
  const totalChanges =
    changes.newStartwork.length +
    changes.updatedStartwork.length +
    changes.endedStartwork.length;

  if (changes.isFirstSnapshot) {
    console.log(
      "[startwork-notification] baseline disimpan, notifikasi awal dilewati."
    );

    return;
  }

  if (totalChanges === 0) {
    console.log(
      "[startwork-notification] tidak ada perubahan STARTWORK."
    );

    return;
  }

  if (!notificationHandler) {
    console.log(
      "[startwork-notification] handler Telegram belum dipasang."
    );

    return;
  }

  try {
    await notificationHandler({
      changes,
      syncResult,
      trigger
    });
  } catch (error) {
    console.error(
      "[startwork-notification-error]",
      error.message
    );
  }
}

async function runWorkOrderSync(trigger = "scheduler") {
  if (isSyncRunning) {
    console.log(
      "[work-order-sync] dilewati: sync sebelumnya masih berjalan."
    );

    return {
      skipped: true,
      reason: "SYNC_IN_PROGRESS",
      trigger,
      ...getWorkOrderSyncStatus()
    };
  }

  isSyncRunning = true;

  syncStatus = {
    ...syncStatus,
    isRunning: true,
    lastStartedAt: new Date().toISOString(),
    lastError: null
  };

  try {
    console.log(
      `[work-order-sync] mengambil data Insera (${trigger})...`
    );

    const result = await syncWorkOrdersFromInsera();

    const currentWorkOrders = getAllWorkOrders();

    const changes = detectStartworkChanges(
      currentWorkOrders,
      result.lastSyncedAt
    );

    replaceStartworkSnapshot(
      currentWorkOrders,
      result.lastSyncedAt
    );

    await notifyStartworkChanges(changes, result, trigger);

    syncStatus = {
      ...syncStatus,
      isRunning: false,
      lastFinishedAt: new Date().toISOString(),
      lastResult: result,
      lastError: null
    };

    console.log("[work-order-sync] selesai", {
      trigger,
      ...result,
      startworkChanges: {
        new: changes.newStartwork.length,
        updated: changes.updatedStartwork.length,
        ended: changes.endedStartwork.length
      }
    });

    return {
      ...result,
      trigger,
      startworkChanges: changes,
      ...getWorkOrderSyncStatus()
    };
  } catch (error) {
    syncStatus = {
      ...syncStatus,
      isRunning: false,
      lastFinishedAt: new Date().toISOString(),
      lastError: error.message
    };

    console.error("[work-order-sync-error]", error.message);

    throw error;
  } finally {
    isSyncRunning = false;
    syncStatus.isRunning = false;
  }
}

function stopWorkOrderScheduler() {
  if (!syncTask) {
    return;
  }

  syncTask.stop();
  syncTask.destroy();
  syncTask = null;

  console.log("[work-order-sync] scheduler sebelumnya dihentikan.");
}

function scheduleWorkOrderSync(intervalMinutes) {
  const interval = Number(intervalMinutes);

  if (!isAllowedInterval(interval)) {
    throw new Error(
      "Interval tidak valid. Gunakan 5, 10, 15, 30, atau 60 menit."
    );
  }

  stopWorkOrderScheduler();

  const cronExpression = getCronExpression(interval);

  syncTask = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runWorkOrderSync("scheduler");
      } catch (error) {
        console.error(
          "[work-order-sync-scheduler-error]",
          error.message
        );
      }
    },
    {
      timezone: "Asia/Jakarta",
      noOverlap: true,
      name: "work-order-sync"
    }
  );

  syncStatus = {
    ...syncStatus,
    intervalMinutes: interval
  };

  console.log(
    `[work-order-sync] scheduler diatur: ${getIntervalLabel(interval)}.`
  );

  return getWorkOrderSyncStatus();
}

function setWorkOrderSyncInterval(intervalMinutes) {
  return scheduleWorkOrderSync(intervalMinutes);
}

function startWorkOrderSyncJob() {
  const initialInterval = getInitialSyncIntervalMinutes();

  scheduleWorkOrderSync(initialInterval);

  console.log(
    `[work-order-sync] sinkronisasi awal dijalankan; scheduler aktif ${getIntervalLabel(
      initialInterval
    )}.`
  );

  runWorkOrderSync("startup").catch((error) => {
    console.error(
      "[work-order-sync-startup-error]",
      error.message
    );
  });

  return getWorkOrderSyncStatus();
}

module.exports = {
  ALLOWED_INTERVALS,
  runWorkOrderSync,
  startWorkOrderSyncJob,
  setWorkOrderSyncInterval,
  setStartworkNotificationHandler,
  getIntervalLabel,
  getWorkOrderSyncStatus
};