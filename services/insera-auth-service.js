const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { authenticator } = require("otplib");
const { inseraConfig } = require("../config/insera");

const STORAGE_DIR = path.join(process.cwd(), "storage");
const SESSION_FILE = path.join(STORAGE_DIR, "insera-session.json");

let browser = null;
let context = null;
let page = null;
let sessionCookies = [];
let isLoggingIn = false;

function getWfmLoginUrl() {
  return "https://wfm.telkom.co.id/jw/web/login";
}

function getWorkOrderPageUrl() {
  const value = String(
    process.env.INSERA_WORK_ORDER_PAGE_URL ||
      inseraConfig.workOrderPageUrl ||
      "https://wfm.telkom.co.id/jw/web/userview/new_wfm/v/_/workorderlist"
  ).trim();

  if (!value) {
    throw new Error("INSERA_WORK_ORDER_PAGE_URL belum diisi di .env.");
  }

  return new URL(value).toString();
}

function getWorkOrderApiUrl() {
  const value = String(
    process.env.INSERA_WORK_ORDER_API_URL || ""
  ).trim();

  if (!value) {
    throw new Error("INSERA_WORK_ORDER_API_URL belum diisi di .env.");
  }

  return new URL(value).toString();
}

function getWorkOrderApiOrigin() {
  return new URL(getWorkOrderApiUrl()).origin;
}

function ensureStorageDirectory() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function hasSavedSession() {
  try {
    return fs.existsSync(SESSION_FILE) &&
      fs.statSync(SESSION_FILE).size > 0;
  } catch {
    return false;
  }
}

function getSessionCookies() {
  return [...sessionCookies];
}

function getCookieHeader() {
  return sessionCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function cookieMatchesHost(cookie, targetUrl) {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    const domain = String(cookie.domain || "")
      .replace(/^\./, "")
      .toLowerCase();

    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function isSsoLoginUrl(url = "") {
  return String(url)
    .toLowerCase()
    .includes("insera-sso.telkom.co.id/jw/web/login");
}

function isWfmLoginUrl(url = "") {
  return String(url)
    .toLowerCase()
    .includes("wfm.telkom.co.id/jw/web/login");
}

function isWfmAuthenticatedUrl(url = "") {
  const value = String(url).toLowerCase();

  return (
    value.includes("wfm.telkom.co.id/jw/web/userview/") &&
    !value.includes("/jw/web/login")
  );
}

function isWorkOrderUrl(url = "") {
  const value = String(url).toLowerCase();

  return (
    value.includes("wfm.telkom.co.id") &&
    value.includes("workorderlist")
  );
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshSessionCookies() {
  if (!context) {
    sessionCookies = [];
    return [];
  }

  const apiOrigin = getWorkOrderApiOrigin();

  try {
    const cookies = await context.cookies([
      getWfmLoginUrl(),
      getWorkOrderPageUrl(),
      getWorkOrderApiUrl(),
      apiOrigin
    ]);

    sessionCookies = cookies.filter((cookie) =>
      cookieMatchesHost(cookie, apiOrigin)
    );

    console.log("[insera-auth] cookie WFM tersedia:", {
      count: sessionCookies.length,
      names: sessionCookies.map((cookie) => cookie.name)
    });

    return getSessionCookies();
  } catch (error) {
    sessionCookies = [];
    throw new Error(
      `Tidak dapat membaca cookie sesi WFM: ${error.message}`
    );
  }
}

async function saveSession() {
  if (!context) {
    return;
  }

  ensureStorageDirectory();

  await context.storageState({
    path: SESSION_FILE
  });

  console.log(
    `[insera-auth] session browser disimpan: ${SESSION_FILE}`
  );
}

async function ensureBrowser() {
  if (browser && browser.isConnected()) {
    return;
  }

  browser = await chromium.launch({
    headless: true
  });
}

async function closeContextOnly() {
  await page?.close().catch(() => {});
  await context?.close().catch(() => {});

  context = null;
  page = null;
  sessionCookies = [];
}

async function createBrowserContext(useSavedSession = false) {
  await ensureBrowser();
  await closeContextOnly();

  const options = {
    viewport: {
      width: 1366,
      height: 768
    }
  };

  if (useSavedSession && hasSavedSession()) {
    options.storageState = SESSION_FILE;

    console.log("[insera-auth] memakai session WFM tersimpan.");
  }

  context = await browser.newContext(options);
  page = await context.newPage();
}

async function findVisibleLocator(scope, selectors) {
  if (!scope) {
    return null;
  }

  for (const selector of selectors) {
    try {
      const locator = scope.locator(selector).first();

      if (
        (await locator.count()) > 0 &&
        (await locator.isVisible())
      ) {
        return locator;
      }
    } catch {
      // Coba selector berikutnya.
    }
  }

  return null;
}

async function waitForVisibleLocator(
  scope,
  selectors,
  timeout = 30_000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const locator = await findVisibleLocator(scope, selectors);

    if (locator) {
      return locator;
    }

    await wait(500);
  }

  return null;
}

async function clickWfmSsoButton() {
  const button = await waitForVisibleLocator(
    page,
    [
      'button:has-text("Login SSO")',
      'a:has-text("Login SSO")',
      'input[value="Login SSO"]',
      'button:has-text("SSO")',
      'a:has-text("SSO")'
    ],
    30_000
  );

  if (!button) {
    return false;
  }

  console.log("[insera-auth] klik tombol Login SSO WFM.");

  await button.click();
  await wait(1_000);

  return true;
}

async function waitForSsoLoginPage(timeout = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (isSsoLoginUrl(page.url())) {
      console.log(
        "[insera-auth] URL setelah klik Login SSO:",
        page.url()
      );

      return true;
    }

    await wait(500);
  }

  return false;
}

function getUsernameSelectors() {
  return [
    "#fake-username",
    'input[placeholder="username" i]',
    'input[placeholder*="username" i]',
    'input[name="username"]',
    'input[name="j_username"]',
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[type="text"]'
  ];
}

function getPasswordSelectors() {
  return [
    "#fake-password",
    'input[placeholder="password" i]',
    'input[placeholder*="password" i]',
    'input[name="password"]',
    'input[name="j_password"]',
    'input[type="password"]'
  ];
}

async function waitForSsoForm() {
  const timeout = 35_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const usernameInput = await findVisibleLocator(
      page,
      getUsernameSelectors()
    );

    const passwordInput = await findVisibleLocator(
      page,
      getPasswordSelectors()
    );

    if (usernameInput && passwordInput) {
      return {
        usernameInput,
        passwordInput
      };
    }

    await wait(500);
  }

  throw new Error(
    "Form username/password INSERA SSO tidak muncul dalam 35 detik."
  );
}

async function acceptTermsOfUse() {
  const checkbox = await waitForVisibleLocator(
    page,
    [
      "#acceptTerms",
      'input[type="checkbox"]'
    ],
    10_000
  );

  if (!checkbox) {
    return false;
  }

  const checked = await checkbox.isChecked().catch(() => false);

  if (!checked) {
    await checkbox.check();
    console.log("[insera-auth] Terms of use disetujui.");
  }

  return true;
}

async function clickSsoLoginButton() {
  const button = await waitForVisibleLocator(
    page,
    [
      "#fake-login",
      'button[id="fake-login"]',
      'button[type="submit"]:has-text("Login")',
      'button:has-text("Login")'
    ],
    30_000
  );

  if (!button) {
    return false;
  }

  console.log("[insera-auth] klik tombol Login INSERA SSO.");

  await button.click();
  await wait(1_000);

  return true;
}

function getOtpInputSelectors() {
  return [
    'input[placeholder="Enter OTP"]',
    'input[placeholder*="OTP" i]',
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[name*="totp" i]',
    'input[id*="totp" i]',
    'input[name*="verification" i]',
    'input[id*="verification" i]',
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[inputmode="numeric"]',
    'input[type="tel"]',
    'input[type="number"]'
  ];
}

async function findOtpInput() {
  const selectors = getOtpInputSelectors();

  const mainLocator = await findVisibleLocator(page, selectors);

  if (mainLocator) {
    return {
      locator: mainLocator,
      scope: page,
      scopeName: "halaman utama"
    };
  }

  for (let index = 0; index < page.frames().length; index += 1) {
    const frame = page.frames()[index];
    const frameLocator = await findVisibleLocator(frame, selectors);

    if (frameLocator) {
      return {
        locator: frameLocator,
        scope: frame,
        scopeName: `iframe ${index}`
      };
    }
  }

  return null;
}

async function waitForOtpInput(timeout = 25_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const otpTarget = await findOtpInput();

    if (otpTarget) {
      console.log(
        `[insera-auth] input OTP ditemukan di ${otpTarget.scopeName}.`
      );

      return otpTarget;
    }

    await wait(500);
  }

  return null;
}

function generateOtp() {
  const secret = String(inseraConfig.otpSecret || "")
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!secret) {
    throw new Error(
      "INSERA_TOTP_SECRET belum tersedia di .env."
    );
  }

  if (
    !authenticator ||
    typeof authenticator.generate !== "function"
  ) {
    throw new Error(
      "Package otplib tidak kompatibel. Jalankan: npm uninstall otplib; npm install otplib@12"
    );
  }

  return authenticator.generate(secret);
}

async function clickOtpSubmitButton(scope) {
  const button = await findVisibleLocator(
    scope,
    [
      'button:has-text("Verify")',
      'button:has-text("Continue")',
      'button:has-text("Submit")',
      'button:has-text("Login")',
      'button:has-text("Confirm")',
      'button[type="submit"]',
      'input[type="submit"]'
    ]
  );

  if (!button) {
    return false;
  }

  console.log("[insera-auth] klik tombol verifikasi TOTP.");

  await button.click();
  return true;
}

async function waitForOtpOrWfm(timeout = 45_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const currentUrl = page.url();

    if (isWfmAuthenticatedUrl(currentUrl)) {
      console.log(
        "[insera-auth] callback WFM berhasil:",
        currentUrl
      );

      return "wfm";
    }

    const otpTarget = await findOtpInput();

    if (otpTarget) {
      return "otp";
    }

    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    if (
      /Time-based One-time Password|TOTP|Google Authenticator|OTP/i.test(
        bodyText
      )
    ) {
      return "otp";
    }

    await wait(500);
  }

  return "timeout";
}

async function submitOtp() {
  const otpTarget = await waitForOtpInput();

  if (!otpTarget) {
    throw new Error(
      "Halaman TOTP terdeteksi, tetapi input OTP tidak ditemukan."
    );
  }

  await otpTarget.locator.fill(generateOtp());

  console.log(
    `[insera-auth] OTP otomatis dibuat dan diisi di ${otpTarget.scopeName}.`
  );

  const submitted = await clickOtpSubmitButton(
    otpTarget.scope
  );

  if (!submitted) {
    console.log(
      "[insera-auth] tombol TOTP tidak ditemukan; mencoba Enter."
    );

    await otpTarget.locator.press("Enter");
  }

  await wait(1_500);

  console.log("[insera-auth] OTP dikirim.");
}

async function openWorkOrderPage() {
  console.log("[insera-auth] membuka halaman Work Order List.");

  await page.goto(getWorkOrderPageUrl(), {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  await wait(1_000);

  console.log(
    "[insera-auth] URL halaman Work Order:",
    page.url()
  );

  if (!isWorkOrderUrl(page.url())) {
    throw new Error(
      `Halaman Work Order tidak dapat dibuka. URL: ${page.url()}`
    );
  }
}

async function tryRestoreSavedSession() {
  if (!hasSavedSession()) {
    return false;
  }

  try {
    await createBrowserContext(true);
    await openWorkOrderPage();
    await refreshSessionCookies();

    if (sessionCookies.length === 0) {
      throw new Error(
        "Cookie API WFM tidak ditemukan dari session tersimpan."
      );
    }

    console.log(
      "[insera-auth] session WFM tersimpan valid dan dipakai."
    );

    return true;
  } catch (error) {
    console.log(
      "[insera-auth] session tersimpan tidak valid:",
      error.message
    );

    await closeContextOnly();
    return false;
  }
}

async function loginInsera() {
  if (isLoggingIn) {
    throw new Error("Proses login WFM sedang berjalan.");
  }

  isLoggingIn = true;

  try {
    if (
      !inseraConfig.username ||
      !inseraConfig.password ||
      !inseraConfig.otpSecret
    ) {
      throw new Error(
        "INSERA_USERNAME, INSERA_PASSWORD, atau INSERA_TOTP_SECRET belum lengkap."
      );
    }

    getWorkOrderPageUrl();
    getWorkOrderApiUrl();

    console.log(
      "[insera-auth] memulai login WFM melalui tombol Login SSO secara headless..."
    );

    await createBrowserContext(false);

    await page.goto(getWfmLoginUrl(), {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });

    console.log(
      "[insera-auth] halaman login WFM terbuka:",
      page.url()
    );

    if (!(await clickWfmSsoButton())) {
      throw new Error(
        "Tombol Login SSO pada halaman WFM tidak ditemukan."
      );
    }

    if (!(await waitForSsoLoginPage())) {
      throw new Error(
        "Klik Login SSO WFM tidak mengarahkan ke halaman INSERA SSO."
      );
    }

    const {
      usernameInput,
      passwordInput
    } = await waitForSsoForm();

    await usernameInput.fill(inseraConfig.username);
    await passwordInput.fill(inseraConfig.password);

    console.log(
      "[insera-auth] username dan password INSERA sudah diisi."
    );

    await acceptTermsOfUse();

    if (!(await clickSsoLoginButton())) {
      throw new Error(
        "Tombol Login INSERA SSO tidak ditemukan."
      );
    }

    let state = await waitForOtpOrWfm();

    if (state === "otp") {
      console.log("[insera-auth] halaman TOTP terdeteksi.");

      await submitOtp();

      state = await waitForOtpOrWfm();
    }

    if (state !== "wfm") {
      throw new Error(
        `Login SSO gagal selesai ke WFM. URL terakhir: ${page.url()}`
      );
    }

    await openWorkOrderPage();
    await refreshSessionCookies();

    if (sessionCookies.length === 0) {
      throw new Error(
        "Sesi WFM terbentuk, tetapi cookie WFM tidak ditemukan."
      );
    }

    await saveSession();

    console.log(
      "[insera-auth] sesi Work Order WFM berhasil terbentuk."
    );

    return {
      success: true,
      cookies: getSessionCookies(),
      cookieHeader: getCookieHeader(),
      url: page.url()
    };
  } catch (error) {
    sessionCookies = [];

    console.error("[insera-auth-error]", error.message);

    throw error;
  } finally {
    isLoggingIn = false;
  }
}

async function getAuthenticatedSession() {
  if (context && page && sessionCookies.length > 0) {
    return {
      success: true,
      cookies: getSessionCookies(),
      cookieHeader: getCookieHeader(),
      url: page.url()
    };
  }

  if (await tryRestoreSavedSession()) {
    return {
      success: true,
      cookies: getSessionCookies(),
      cookieHeader: getCookieHeader(),
      url: page.url()
    };
  }

  return loginInsera();
}

async function clearSession() {
  sessionCookies = [];

  if (context) {
    await context.clearCookies().catch(() => {});
  }

  try {
    fs.unlinkSync(SESSION_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  console.log("[insera-auth] session dibersihkan.");
}

async function closeInseraBrowser() {
  try {
    await closeContextOnly();
    await browser?.close().catch(() => {});
  } finally {
    browser = null;
    context = null;
    page = null;
    sessionCookies = [];
    isLoggingIn = false;
  }

  console.log("[insera-auth] browser headless ditutup.");
}

module.exports = {
  loginInsera,
  getAuthenticatedSession,
  getSessionCookies,
  getCookieHeader,
  refreshSessionCookies,
  clearSession,
  closeInseraBrowser,
  generateOtp
};