
"use strict";

/**
 * AWS Serverless Student Portfolio
 * Amazon Cognito Authentication
 *
 * OAuth 2.0 Authorization Code + PKCE (S256)
 * AWS Region: ap-south-1 (Mumbai)
 *
 * IMPORTANT:
 * This file handles browser authentication only.
 * AWS Lambda must verify JWT access tokens and
 * administrator permissions for protected API calls.
 */

// ============================================================
// 1. AMAZON COGNITO CONFIGURATION
// ============================================================

const COGNITO_CONFIG = Object.freeze({
  region: "ap-south-1",

  userPoolId: "ap-south-1_CQ6N2FL3Z",

  clientId: "2gnvmkc5l9cm3ab9mq8rm0n8uq",

  domain:
    "https://ap-south-1cq6n2fl3z.auth.ap-south-1.amazoncognito.com",

  // Public portfolio callback
  redirectUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/",

  // Separate administrator dashboard callback
  adminRedirectUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/admin.html",

  // Public portfolio logout destination
  logoutUri:
    "https://santhoshpranavk.github.io/AWS-Serverless-Student-Portfolio/",

  scopes: ["openid", "email"]
});

// ============================================================
// 2. AUTHENTICATION CONSTANTS AND STATE
// ============================================================

const AUTH_STORAGE_KEY =
  "portfolio_cognito_auth_request";

const AUTH_REQUEST_MAX_AGE = 5 * 60 * 1000;

const TOKEN_EXPIRY_BUFFER = 30 * 1000;

const PKCE_VERIFIER_PATTERN =
  /^[A-Za-z0-9._~-]{43,128}$/;

const OAUTH_STATE_PATTERN =
  /^[a-f0-9]{64}$/;

// Access tokens remain in JavaScript memory.
// They are lost on page reload or navigation.
let cognitoTokens = null;
let cognitoTokenExpiresAt = 0;

let callbackProcessingPromise = null;

// ============================================================
// 3. ALLOWED CALLBACK URL VALIDATION
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
    throw new Error(
      "Unsupported Cognito redirect URI."
    );
  }

  return redirectUri;
}

// ============================================================
// 4. SECURE RANDOM VALUE GENERATION
// ============================================================

function generateSecureRandomHex() {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error(
      "Secure random generation is unavailable."
    );
  }

  const randomBytes = new Uint8Array(32);

  window.crypto.getRandomValues(randomBytes);

  return Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

// ============================================================
// 5. PKCE CODE VERIFIER
// ============================================================

function generateCodeVerifier() {
  return generateSecureRandomHex();
}

// ============================================================
// 6. PKCE SHA-256 CODE CHALLENGE
// ============================================================

async function generateCodeChallenge(codeVerifier) {
  if (
    typeof codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(codeVerifier)
  ) {
    throw new Error("Invalid PKCE code verifier.");
  }

  if (!window.crypto || !window.crypto.subtle) {
    throw new Error(
      "Secure cryptographic operations are unavailable."
    );
  }

  const encodedVerifier =
    new TextEncoder().encode(codeVerifier);

  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    encodedVerifier
  );

  const digestBytes = new Uint8Array(digest);

  const base64 = btoa(
    String.fromCharCode(...digestBytes)
  );

  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ============================================================
// 7. OAUTH STATE GENERATION
// ============================================================

function generateOAuthState() {
  return generateSecureRandomHex();
}

// ============================================================
// 8. TEMPORARY LOGIN REQUEST STORAGE
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

  const authRequest = {
    codeVerifier,
    state,
    redirectUri,
    createdAt: Date.now()
  };

  // Temporary PKCE and state values are stored
  // only for this browser tab's login attempt.
  sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(authRequest)
  );
}

function clearAuthRequest() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

// ============================================================
// 9. BUILD COGNITO AUTHORIZATION URL
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

  url.searchParams.set(
    "response_type",
    "code"
  );

  url.searchParams.set(
    "client_id",
    COGNITO_CONFIG.clientId
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  url.searchParams.set(
    "scope",
    COGNITO_CONFIG.scopes.join(" ")
  );

  url.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  url.searchParams.set(
    "code_challenge",
    codeChallenge
  );

  url.searchParams.set(
    "state",
    state
  );

  return url.toString();
}

// ============================================================
// 10. START COGNITO LOGIN
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

    // Create a fresh PKCE verifier and challenge.
    const codeVerifier = generateCodeVerifier();

    const codeChallenge =
      await generateCodeChallenge(codeVerifier);

    // Create a fresh OAuth state.
    const state = generateOAuthState();

    // Save the original redirect URI with the
    // PKCE verifier and state.
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

    alert(
      "Unable to start sign-in. Please try again."
    );

    return false;
  }
}

// ============================================================
// 11. START ADMIN DASHBOARD LOGIN
// ============================================================

function loginAdminWithCognito() {
  return loginWithCognito(
    COGNITO_CONFIG.adminRedirectUri
  );
}

// ============================================================
// 12. DETECT COGNITO CALLBACK
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
  const cleanUrl = new URL(
    window.location.href
  );

  const oauthParameters = [
    "code",
    "state",
    "error",
    "error_description"
  ];

  for (const parameter of oauthParameters) {
    cleanUrl.searchParams.delete(parameter);
  }

  window.history.replaceState(
    window.history.state,
    document.title,
    cleanUrl.toString()
  );
}

// ============================================================
// 13. READ AND VALIDATE OAUTH CALLBACK
// ============================================================

function readCognitoCallback() {
  const params = new URLSearchParams(
    window.location.search
  );

  if (!hasCognitoCallback()) {
    return null;
  }

  const returnedState = params.get("state");
  const authorizationCode = params.get("code");
  const oauthError = params.get("error");

  // Remove OAuth response parameters from the URL.
  cleanCognitoCallbackUrl();

  const savedRequest = sessionStorage.getItem(
    AUTH_STORAGE_KEY
  );

  // Consume the request once to prevent reuse.
  clearAuthRequest();

  if (!savedRequest) {
    throw new Error(
      "No matching authentication request exists."
    );
  }

  let authRequest;

  try {
    authRequest = JSON.parse(savedRequest);
  } catch {
    throw new Error(
      "The saved authentication request is invalid."
    );
  }

  if (
    !authRequest ||
    typeof authRequest !== "object" ||
    Array.isArray(authRequest)
  ) {
    throw new Error(
      "Invalid authentication request data."
    );
  }

  const now = Date.now();

  // Reject expired or future-dated requests.
  if (
    typeof authRequest.createdAt !== "number" ||
    !Number.isFinite(authRequest.createdAt) ||
    authRequest.createdAt > now ||
    now - authRequest.createdAt >
      AUTH_REQUEST_MAX_AGE
  ) {
    throw new Error(
      "The authentication request has expired."
    );
  }

  // Validate the OAuth state.
  if (
    typeof authRequest.state !== "string" ||
    !OAUTH_STATE_PATTERN.test(authRequest.state) ||
    !returnedState ||
    returnedState !== authRequest.state
  ) {
    throw new Error(
      "OAuth state validation failed."
    );
  }

  // Validate the original callback destination.
  const redirectUri =
    authRequest.redirectUri === undefined
      ? COGNITO_CONFIG.redirectUri
      : authRequest.redirectUri;

  validateCognitoRedirectUri(redirectUri);

  const currentCallbackUrl =
    window.location.origin +
    window.location.pathname;

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
    throw new Error(
      "Missing Cognito authorization code."
    );
  }

  if (
    typeof authRequest.codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(
      authRequest.codeVerifier
    )
  ) {
    throw new Error(
      "The saved PKCE verifier is invalid."
    );
  }

  return {
    authorizationCode,
    codeVerifier: authRequest.codeVerifier,
    redirectUri
  };
}

// ============================================================
// 14. EXCHANGE AUTHORIZATION CODE FOR TOKENS
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
    throw new Error(
      "Missing authorization code."
    );
  }

  if (
    typeof codeVerifier !== "string" ||
    !PKCE_VERIFIER_PATTERN.test(codeVerifier)
  ) {
    throw new Error(
      "Invalid PKCE code verifier."
    );
  }

  validateCognitoRedirectUri(redirectUri);

  const tokenUrl = new URL(
    "/oauth2/token",
    COGNITO_CONFIG.domain
  );

  const requestBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CONFIG.clientId,
    code: authorizationCode,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const response = await fetch(
    tokenUrl.toString(),
    {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: requestBody.toString()
    }
  );

  if (!response.ok) {
    throw new Error(
      "Cognito token exchange failed."
    );
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
// 15. IN-MEMORY SESSION MANAGEMENT
// ============================================================

function setCognitoSession(tokens) {
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0
  ) {
    throw new Error(
      "Invalid Cognito session data."
    );
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

  const tokenIsValidForUse =
    Date.now() + TOKEN_EXPIRY_BUFFER <
    cognitoTokenExpiresAt;

  if (!tokenIsValidForUse) {
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
// 16. AUTHENTICATION CHANGE EVENT
// ============================================================

function notifyCognitoAuthChanged() {
  window.dispatchEvent(
    new CustomEvent(
      "portfolio:auth-changed",
      {
        detail: {
          authenticated:
            isCognitoAuthenticated()
        }
      }
    )
  );
}

// ============================================================
// 17. HANDLE COGNITO CALLBACK
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

      // Use the exact callback URL selected
      // when the login request was created.
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
        "Sign-in could not be completed. " +
        "Please try again."
      );

      return false;
    }
  })();

  return callbackProcessingPromise;
}

// ============================================================
// 18. SIGN OUT
// ============================================================

function logoutWithCognito() {
  clearCognitoSession();
  clearAuthRequest();

  notifyCognitoAuthChanged();

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
    COGNITO_CONFIG.logoutUri
  );

  window.location.assign(
    logoutUrl.toString()
  );
}

// ============================================================
// 19. INITIALIZE AUTHENTICATION
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
    sessionStorage.getItem(
      AUTH_STORAGE_KEY
    ) !== null;

  if (!hasPendingRequest) {
    // Avoid processing unsolicited OAuth callbacks.
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
// 20. AUTOMATIC INITIALIZATION
// ============================================================

// A shared promise lets other scripts wait for
// callback processing to finish, including scripts
// loaded after DOMContentLoaded.

let cognitoInitializationPromise = null;

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
// 21. PUBLIC AUTHENTICATION API
// ============================================================

// Existing functions remain available to scripts
// loaded with ordinary <script> tags.
//
// Public portfolio login:
//   loginWithCognito()
//
// Admin dashboard login:
//   loginAdminWithCognito()
//
// Current session check:
//   isCognitoAuthenticated()
//
// Access token for protected API requests:
//   getCognitoAccessToken()
//
// Logout:
//   logoutWithCognito()
//
// Wait for OAuth callback processing:
//   await waitForCognitoInitialization()
//
// IMPORTANT:
// isCognitoAuthenticated() confirms only that an
// unexpired Cognito access token exists in memory.
// It does not prove that the user is an administrator.
