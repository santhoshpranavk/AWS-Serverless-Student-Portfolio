
"use strict";

/**
 * AWS Serverless Student Portfolio
 * Amazon Cognito Authentication
 *
 * OAuth 2.0 Authorization Code + PKCE (S256)
 * AWS Region: ap-south-1 (Mumbai)
 *
 * Authentication tokens are stored in memory only.
 * AWS Lambda must independently verify access tokens
 * and administrator permissions.
 */

// ============================================================
// 1. COGNITO CONFIGURATION
// ============================================================

const COGNITO_CONFIG = Object.freeze({
  region: "ap-south-1",

  userPoolId: "ap-south-1_CQ6N2FL3Z",

  clientId: "2gnvmkc5l9cm3ab9mq8rm0n8uq",

  domain:
    "https://ap-south-1cq6n2fl3z.auth.ap-south-1.amazoncognito.com",

  // Public portfolio login callback
  redirectUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/",

  // Admin dashboard login callback
  adminRedirectUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/admin.html",

  // Public portfolio logout destination
  logoutUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/",

  // NEW: Admin dashboard logout destination
  adminLogoutUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/admin.html",

  scopes: ["openid", "email"]
});

// ============================================================
// 2. AUTHENTICATION STATE
// ============================================================

const AUTH_STORAGE_KEY =
  "portfolio_cognito_auth_request";

const AUTH_REQUEST_MAX_AGE = 5 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER = 30 * 1000;

const PKCE_VERIFIER_PATTERN =
  /^[A-Za-z0-9._~-]{43,128}$/;

const OAUTH_STATE_PATTERN =
  /^[a-f0-9]{64}$/;

let cognitoTokens = null;
let cognitoTokenExpiresAt = 0;

let callbackProcessingPromise = null;
let cognitoInitializationPromise = null;

// ============================================================
// 3. ALLOWED LOGIN CALLBACKS
// ============================================================

function getAllowedCognitoRedirectUris() {
  return [
    COGNITO_CONFIG.redirectUri,
    COGNITO_CONFIG.adminRedirectUri
  ];
}

function validateCognitoRedirectUri(redirectUri) {
  if (
    typeof redirectUri !== "string" ||
    !getAllowedCognitoRedirectUris().includes(redirectUri)
  ) {
    throw new Error("Unsupported Cognito redirect URI.");
  }

  return redirectUri;
}

// ============================================================
// 4. SECURE RANDOM GENERATION
// ============================================================

function generateSecureRandomHex() {
  if (
    !window.crypto ||
    !window.crypto.getRandomValues
  ) {
    throw new Error(
      "Secure random generation is unavailable."
    );
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

// ============================================================
// 5. PKCE HELPERS
// ============================================================

function generateCodeVerifier() {
  return generateSecureRandomHex();
}

async function generateCodeChallenge(codeVerifier) {
  if (
    typeof codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(codeVerifier)
  ) {
    throw new Error("Invalid PKCE code verifier.");
  }

  if (
    !window.crypto ||
    !window.crypto.subtle
  ) {
    throw new Error(
      "Secure cryptographic operations are unavailable."
    );
  }

  const encoded = new TextEncoder().encode(codeVerifier);

  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    encoded
  );

  const base64 = btoa(
    String.fromCharCode(...new Uint8Array(digest))
  );

  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateOAuthState() {
  return generateSecureRandomHex();
}

// ============================================================
// 6. TEMPORARY LOGIN REQUEST STORAGE
// ============================================================

function storeAuthRequest(
  codeVerifier,
  state,
  redirectUri = COGNITO_CONFIG.redirectUri
) {
  if (
    typeof codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(codeVerifier)
  ) {
    throw new Error("Invalid PKCE code verifier.");
  }

  if (
    typeof state !== "string" ||
    !OAUTH_STATE_PATTERN.test(state)
  ) {
    throw new Error("Invalid OAuth state.");
  }

  validateCognitoRedirectUri(redirectUri);

  sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      codeVerifier,
      state,
      redirectUri,
      createdAt: Date.now()
    })
  );
}

function clearAuthRequest() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

// ============================================================
// 7. BUILD LOGIN URL
// ============================================================

function buildCognitoAuthorizationUrl(
  codeChallenge,
  state,
  redirectUri = COGNITO_CONFIG.redirectUri
) {
  if (
    typeof codeChallenge !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)
  ) {
    throw new Error("Invalid PKCE code challenge.");
  }

  if (
    typeof state !== "string" ||
    !OAUTH_STATE_PATTERN.test(state)
  ) {
    throw new Error("Invalid OAuth state.");
  }

  validateCognitoRedirectUri(redirectUri);

  const url = new URL(
    "/oauth2/authorize",
    COGNITO_CONFIG.domain
  );

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", COGNITO_CONFIG.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", COGNITO_CONFIG.scopes.join(" "));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);

  return url.toString();
}

// ============================================================
// 8. START LOGIN
// ============================================================

async function loginWithCognito(
  redirectUri = COGNITO_CONFIG.redirectUri
) {
  try {
    if (
      !window.isSecureContext ||
      !window.crypto ||
      !window.crypto.subtle
    ) {
      throw new Error(
        "A secure browser context is required."
      );
    }

    validateCognitoRedirectUri(redirectUri);

    const codeVerifier = generateCodeVerifier();

    const codeChallenge =
      await generateCodeChallenge(codeVerifier);

    const state = generateOAuthState();

    storeAuthRequest(
      codeVerifier,
      state,
      redirectUri
    );

    const authorizationUrl =
      buildCognitoAuthorizationUrl(
        codeChallenge,
        state,
        redirectUri
      );

    window.location.assign(authorizationUrl);

    return true;
  } catch (error) {
    clearAuthRequest();

    console.error(
      "[Cognito] Unable to start authentication:",
      error
    );

    alert("Unable to start sign-in. Please try again.");

    return false;
  }
}

// ============================================================
// 9. ADMIN LOGIN
// ============================================================

function loginAdminWithCognito() {
  return loginWithCognito(
    COGNITO_CONFIG.adminRedirectUri
  );
}

// ============================================================
// 10. DETECT OAUTH CALLBACK
// ============================================================

function hasCognitoCallback() {
  const params = new URLSearchParams(
    window.location.search
  );

  return (
    params.has("state") &&
    (params.has("code") || params.has("error"))
  );
}

function cleanCognitoCallbackUrl() {
  const cleanUrl = new URL(window.location.href);

  for (const parameter of [
    "code",
    "state",
    "error",
    "error_description"
  ]) {
    cleanUrl.searchParams.delete(parameter);
  }

  window.history.replaceState(
    window.history.state,
    document.title,
    cleanUrl.toString()
  );
}

// ============================================================
// 11. VALIDATE LOGIN CALLBACK
// ============================================================

function readCognitoCallback() {
  if (!hasCognitoCallback()) {
    return null;
  }

  const params = new URLSearchParams(
    window.location.search
  );

  const returnedState = params.get("state");
  const authorizationCode = params.get("code");
  const oauthError = params.get("error");

  cleanCognitoCallbackUrl();

  const savedRequest =
    sessionStorage.getItem(AUTH_STORAGE_KEY);

  clearAuthRequest();

  if (!savedRequest) {
    throw new Error(
      "No matching authentication request exists."
    );
  }

  let request;

  try {
    request = JSON.parse(savedRequest);
  } catch {
    throw new Error(
      "The saved authentication request is invalid."
    );
  }

  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    throw new Error("Invalid authentication request data.");
  }

  const now = Date.now();

  if (
    typeof request.createdAt !== "number" ||
    !Number.isFinite(request.createdAt) ||
    request.createdAt > now ||
    now - request.createdAt > AUTH_REQUEST_MAX_AGE
  ) {
    throw new Error(
      "The authentication request has expired."
    );
  }

  if (
    typeof request.state !== "string" ||
    !OAUTH_STATE_PATTERN.test(request.state) ||
    !returnedState ||
    returnedState !== request.state
  ) {
    throw new Error("OAuth state validation failed.");
  }

  const redirectUri =
    request.redirectUri === undefined
      ? COGNITO_CONFIG.redirectUri
      : request.redirectUri;

  validateCognitoRedirectUri(redirectUri);

  const currentCallbackUrl =
    window.location.origin + window.location.pathname;

  if (currentCallbackUrl !== redirectUri) {
    throw new Error(
      "Cognito callback destination mismatch."
    );
  }

  if (oauthError) {
    throw new Error(
      "Amazon Cognito did not complete sign-in."
    );
  }

  if (
    typeof authorizationCode !== "string" ||
    !authorizationCode
  ) {
    throw new Error("Missing Cognito authorization code.");
  }

  if (
    typeof request.codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(request.codeVerifier)
  ) {
    throw new Error("The saved PKCE verifier is invalid.");
  }

  return {
    authorizationCode,
    codeVerifier: request.codeVerifier,
    redirectUri
  };
}

// ============================================================
// 12. EXCHANGE CODE FOR TOKENS
// ============================================================

async function exchangeCognitoCode(
  authorizationCode,
  codeVerifier,
  redirectUri = COGNITO_CONFIG.redirectUri
) {
  if (
    typeof authorizationCode !== "string" ||
    !authorizationCode
  ) {
    throw new Error("Missing authorization code.");
  }

  if (
    typeof codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(codeVerifier)
  ) {
    throw new Error("Invalid PKCE code verifier.");
  }

  validateCognitoRedirectUri(redirectUri);

  const tokenUrl = new URL(
    "/oauth2/token",
    COGNITO_CONFIG.domain
  );

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CONFIG.clientId,
    code: authorizationCode,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error("Cognito token exchange failed.");
  }

  const tokens = await response.json();

  if (
    !tokens ||
    typeof tokens !== "object" ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    typeof tokens.id_token !== "string" ||
    !tokens.id_token ||
    tokens.token_type !== "Bearer" ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0
  ) {
    throw new Error(
      "Cognito returned an invalid token response."
    );
  }

  return tokens;
}

// ============================================================
// 13. IN-MEMORY SESSION MANAGEMENT
// ============================================================

function setCognitoSession(tokens) {
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0
  ) {
    throw new Error("Invalid Cognito session data.");
  }

  cognitoTokens = tokens;

  cognitoTokenExpiresAt =
    Date.now() + tokens.expires_in * 1000;
}

function clearCognitoSession() {
  cognitoTokens = null;
  cognitoTokenExpiresAt = 0;
}

function isCognitoAuthenticated() {
  if (
    !cognitoTokens ||
    !cognitoTokens.access_token
  ) {
    return false;
  }

  if (
    Date.now() + TOKEN_EXPIRY_BUFFER >=
    cognitoTokenExpiresAt
  ) {
    clearCognitoSession();
    return false;
  }

  return true;
}

function getCognitoAccessToken() {
  if (!isCognitoAuthenticated()) {
    return null;
  }

  return cognitoTokens.access_token;
}

// ============================================================
// 14. AUTHENTICATION CHANGE NOTIFICATION
// ============================================================

function notifyCognitoAuthChanged() {
  window.dispatchEvent(
    new CustomEvent("portfolio:auth-changed", {
      detail: {
        authenticated: isCognitoAuthenticated()
      }
    })
  );
}

// ============================================================
// 15. PROCESS COGNITO CALLBACK
// ============================================================

async function handleCognitoCallback() {
  if (callbackProcessingPromise) {
    return callbackProcessingPromise;
  }

  callbackProcessingPromise = (async () => {
    try {
      const callback = readCognitoCallback();

      if (!callback) {
        return false;
      }

      const tokens = await exchangeCognitoCode(
        callback.authorizationCode,
        callback.codeVerifier,
        callback.redirectUri
      );

      setCognitoSession(tokens);

      console.info(
        "[Cognito] Authentication completed successfully."
      );

      notifyCognitoAuthChanged();

      return true;
    } catch (error) {
      clearCognitoSession();

      console.error(
        "[Cognito] Authentication callback failed:",
        error
      );

      notifyCognitoAuthChanged();

      alert(
        "Sign-in could not be completed. Please try again."
      );

      return false;
    }
  })();

  return callbackProcessingPromise;
}

// ============================================================
// 16. LOGOUT DESTINATION
// ============================================================

function getCognitoLogoutDestination() {
  const currentPage =
    window.location.origin + window.location.pathname;

  // NEW:
  // When logging out from admin.html, return to
  // the admin login screen instead of the portfolio.
  if (currentPage === COGNITO_CONFIG.adminRedirectUri) {
    return COGNITO_CONFIG.adminLogoutUri;
  }

  // Preserve the original public-site behavior.
  return COGNITO_CONFIG.logoutUri;
}

// ============================================================
// 17. SIGN OUT
// ============================================================

function logoutWithCognito() {
  const logoutDestination =
    getCognitoLogoutDestination();

  // Remove the local in-memory session.
  clearCognitoSession();

  // Remove any unfinished login request.
  clearAuthRequest();

  // Notify the dashboard to lock its controls.
  notifyCognitoAuthChanged();

  // Sign out from the Cognito managed login session.
  const logoutUrl = new URL(
    "/logout",
    COGNITO_CONFIG.domain
  );

  logoutUrl.searchParams.set(
    "client_id",
    COGNITO_CONFIG.clientId
  );

  logoutUrl.searchParams.set(
    "logout_uri",
    logoutDestination
  );

  window.location.assign(logoutUrl.toString());
}

// ============================================================
// 18. INITIALIZE AUTHENTICATION
// ============================================================

async function initializeCognitoAuth() {
  const params = new URLSearchParams(
    window.location.search
  );

  const hasOAuthParameters =
    params.has("code") ||
    params.has("state") ||
    params.has("error");

  if (!hasOAuthParameters) {
    return false;
  }

  const hasPendingRequest =
    sessionStorage.getItem(AUTH_STORAGE_KEY) !== null;

  if (!hasPendingRequest) {
    cleanCognitoCallbackUrl();

    console.warn(
      "[Cognito] Callback received without a pending login request."
    );

    return false;
  }

  if (!hasCognitoCallback()) {
    cleanCognitoCallbackUrl();
    clearAuthRequest();

    console.error(
      "[Cognito] Incomplete OAuth callback."
    );

    return false;
  }

  return handleCognitoCallback();
}

// ============================================================
// 19. AUTOMATIC INITIALIZATION
// ============================================================

function startCognitoInitialization() {
  if (!cognitoInitializationPromise) {
    cognitoInitializationPromise =
      initializeCognitoAuth().catch((error) => {
        clearCognitoSession();
        clearAuthRequest();

        console.error(
          "[Cognito] Initialization failed:",
          error
        );

        notifyCognitoAuthChanged();

        return false;
      });
  }

  return cognitoInitializationPromise;
}

function waitForCognitoInitialization() {
  return startCognitoInitialization();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void startCognitoInitialization();
    },
    { once: true }
  );
} else {
  void startCognitoInitialization();
}

// ============================================================
// 20. PUBLIC AUTHENTICATION API
// ============================================================

// Public login:
//   loginWithCognito()
//
// Admin login:
//   loginAdminWithCognito()
//
// Authentication state:
//   isCognitoAuthenticated()
//
// Protected API token:
//   getCognitoAccessToken()
//
// Logout:
//   logoutWithCognito()
//
// Wait for Cognito initialization:
//   await waitForCognitoInitialization()
//
// IMPORTANT:
// A valid Cognito token does not automatically mean
// the user is an administrator. The backend must
// enforce administrator permissions.
