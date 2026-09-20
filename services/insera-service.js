const axios = require("axios");
const {
  inseraConfig,
  validateInseraConfig
} = require("../config/insera");

let accessToken = null;

function buildHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {})
  };
}

async function loginToInsera() {
  validateInseraConfig();

  const response = await axios.post(
    inseraConfig.loginUrl,
    {
      username: inseraConfig.username,
      password: inseraConfig.password

      // Jangan tambahkan OTP otomatis dulu.
      // Kita perlu memastikan format OTP yang diminta API.
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  const responseData = response.data;

  accessToken =
    responseData.access_token ||
    responseData.token ||
    responseData.data?.access_token ||
    responseData.data?.token ||
    null;

  if (!accessToken) {
    throw new Error(
      "Login berhasil merespons, tetapi access token tidak ditemukan. Periksa format respons API Insera."
    );
  }

  return accessToken;
}

async function getInseraWorkOrders() {
  if (!accessToken) {
    await loginToInsera();
  }

  // GANTI path ini nanti setelah endpoint Work Order resmi diketahui.
  const workOrderUrl = `${inseraConfig.baseUrl}/api/work-orders`;

  const response = await axios.get(workOrderUrl, {
    headers: buildHeaders(),
    timeout: 20000
  });

  return response.data;
}

module.exports = {
  loginToInsera,
  getInseraWorkOrders
};