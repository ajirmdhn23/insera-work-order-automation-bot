const inseraConfig = {
  baseUrl: process.env.INSERA_BASE_URL,
  loginUrl: process.env.INSERA_LOGIN_URL,
  username: process.env.INSERA_USERNAME,
  password: process.env.INSERA_PASSWORD,
  otpSecret: process.env.INSERA_OTP_SECRET
};

function validateInseraConfig() {
  const requiredVariables = [
    "INSERA_BASE_URL",
    "INSERA_LOGIN_URL",
    "INSERA_USERNAME",
    "INSERA_PASSWORD",
    "INSERA_OTP_SECRET"
  ];

  const missingVariables = requiredVariables.filter(
    (variableName) => !process.env[variableName]
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