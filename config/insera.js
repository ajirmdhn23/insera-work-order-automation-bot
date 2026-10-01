const inseraConfig = {
  baseUrl: process.env.INSERA_BASE_URL,
  loginUrl: process.env.INSERA_LOGIN_URL,

  workOrderPageUrl: process.env.INSERA_WORK_ORDER_PAGE_URL,
  workOrderApiUrl: process.env.INSERA_WORK_ORDER_API_URL,

  username: process.env.INSERA_USERNAME,
  password: process.env.INSERA_PASSWORD,
  otpSecret: process.env.INSERA_TOTP_SECRET
};

console.log("[insera-config] konfigurasi API:", {
  baseUrl: inseraConfig.baseUrl,
  loginUrl: inseraConfig.loginUrl,
  workOrderPageUrl: inseraConfig.workOrderPageUrl,
  workOrderApiConfigured: Boolean(inseraConfig.workOrderApiUrl)
});

function validateInseraConfig() {
  const requiredVariables = [
    "INSERA_BASE_URL",
    "INSERA_LOGIN_URL",
    "INSERA_WORK_ORDER_API_URL",
    "INSERA_USERNAME",
    "INSERA_PASSWORD",
    "INSERA_TOTP_SECRET"
  ];

  const missingVariables = requiredVariables.filter(
    variableName => !process.env[variableName]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Konfigurasi Insera belum lengkap: ${missingVariables.join(", ")}`
    );
  }
}

module.exports = {
  inseraConfig,
  validateInseraConfig
};
