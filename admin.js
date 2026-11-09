
"use strict";

/*
 * ============================================================
 * PRANAV K — AWS CLOUD.DEV ADMIN CONSOLE
 *
 * File: admin.js
 *
 * Amazon Cognito + AWS Lambda Admin Authorization
 *
 * SECURITY:
 * - Cognito authenticates the user.
 * - AWS Lambda verifies administrator permissions.
 * - Dashboard stays locked unless backend approves.
 * - Access tokens are never logged or stored here.
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================================
  // 1. CONFIGURATION
  // ==========================================================

  const ADMIN_AUTH_URL =
    "https://90y9wzfm46tg51xd.qws.lambda-web.ap-south-1.on.aws/api/admin/me";

  // ==========================================================
  // 2. DASHBOARD ELEMENTS
  // ==========================================================

  const adminApp =
    document.getElementById("adminApp");

  const authGate =
    document.getElementById("authGate");

  const authGateMessage =
    document.getElementById("authGateMessage");

  const adminLoginBtn =
    document.getElementById("adminLoginBtn");

  const adminLogoutBtn =
    document.getElementById("adminLogoutBtn");

  // Prevent outdated authorization requests from
  // unlocking the dashboard after an auth change.
  let authorizationRequestId = 0;

  let authorizationController = null;

  // ==========================================================
  // 3. DASHBOARD SECURITY
  // ==========================================================

  function lockDashboard() {
    if (adminApp) {
      adminApp.hidden = true;
    }

    if (authGate) {
      authGate.hidden = false;
    }
  }

  function unlockDashboard() {
    if (authGate) {
      authGate.hidden = true;
    }

    if (adminApp) {
      adminApp.hidden = false;
    }
  }

  function cancelPendingAuthorization() {
    authorizationRequestId += 1;

    if (authorizationController) {
      authorizationController.abort();
      authorizationController = null;
    }
  }

  lockDashboard();

  // ==========================================================
  // 4. STATUS MESSAGES
  // ==========================================================

  function setAuthMessage(message) {
    if (authGateMessage) {
      authGateMessage.textContent = message;
    }
  }

  // ==========================================================
  // 5. LOGIN BUTTON
  // ==========================================================

  function setLoginButtonState({
    disabled = false,
    loading = false
  } = {}) {
    if (!adminLoginBtn) {
      return;
    }

    adminLoginBtn.disabled = disabled;

    adminLoginBtn.setAttribute(
      "aria-busy",
      String(loading)
    );

    if (loading) {
      adminLoginBtn.textContent =
        "Redirecting to Amazon Cognito...";
    } else {
      adminLoginBtn.innerHTML =
        '<i class="fa-solid fa-right-to-bracket" ' +
        'aria-hidden="true"></i>' +
        " Login with Amazon Cognito";
    }
  }

  // ==========================================================
  // 6. CHECK COGNITO FUNCTIONS
  // ==========================================================

  function cognitoFunctionsAvailable() {
    return (
      typeof loginAdminWithCognito === "function" &&
      typeof isCognitoAuthenticated === "function" &&
      typeof waitForCognitoInitialization === "function" &&
      typeof getCognitoAccessToken === "function"
    );
  }

  // ==========================================================
  // 7. SIGNED-OUT STATE
  // ==========================================================

  function showSignedOutState() {
    cancelPendingAuthorization();

    lockDashboard();

    setAuthMessage(
      "Securely sign in with Amazon Cognito " +
      "to verify your identity and continue."
    );

    if (adminLoginBtn) {
      adminLoginBtn.hidden = false;
    }

    setLoginButtonState({
      disabled: false,
      loading: false
    });
  }

  // ==========================================================
  // 8. VERIFY ADMINISTRATOR WITH AWS LAMBDA
  // ==========================================================

  async function verifyAdministratorAccess() {
    cancelPendingAuthorization();

    const requestId = authorizationRequestId;

    lockDashboard();

    if (!cognitoFunctionsAvailable()) {
      setAuthMessage(
        "Authentication services are unavailable. " +
        "Please refresh the page."
      );

      return;
    }

    const accessToken = getCognitoAccessToken();

    if (!accessToken) {
      showSignedOutState();
      return;
    }

    if (adminLoginBtn) {
      adminLoginBtn.hidden = true;
      adminLoginBtn.disabled = true;
    }

    setAuthMessage(
      "Cognito sign-in successful. " +
      "Verifying administrator permissions with AWS..."
    );

    const controller = new AbortController();
    authorizationController = controller;

    try {
      const response = await fetch(
        ADMIN_AUTH_URL,
        {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",

          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json"
          },

          signal: controller.signal
        }
      );

      // Ignore results from obsolete requests.
      if (
        requestId !== authorizationRequestId ||
        controller.signal.aborted
      ) {
        return;
      }

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (
        requestId !== authorizationRequestId ||
        controller.signal.aborted
      ) {
        return;
      }

      // Do not rely only on a successful HTTP status.
      // Require the backend's explicit authorization.
      const authorized =
        response.ok &&
        result?.status === "success" &&
        result?.authorized === true &&
        result?.role === "PortfolioAdmins";

      if (
        authorized &&
        isCognitoAuthenticated() &&
        getCognitoAccessToken() === accessToken
      ) {
        unlockDashboard();

        console.info(
          "[Admin] Administrator authorization verified."
        );

        return;
      }

      lockDashboard();

      if (response.status === 401) {
        setAuthMessage(
          "Your authentication session is invalid " +
          "or expired. Please sign in again."
        );
      } else if (response.status === 403) {
        setAuthMessage(
          "Access denied. Your Cognito account " +
          "does not have PortfolioAdmins permission."
        );
      } else if (response.status === 503) {
        setAuthMessage(
          "Administrator verification is temporarily " +
          "unavailable. Please try again later."
        );
      } else {
        setAuthMessage(
          "Administrator authorization could not " +
          "be verified. Dashboard access remains locked."
        );
      }

      console.warn(
        "[Admin] Administrator authorization was not granted."
      );

    } catch (error) {
      if (
        requestId !== authorizationRequestId ||
        controller.signal.aborted
      ) {
        return;
      }

      lockDashboard();

      setAuthMessage(
        "Unable to connect to the administrator " +
        "verification service. Please try again later."
      );

      // Do not print access tokens or authorization headers.
      console.error(
        "[Admin] Authorization request failed:",
        error.message
      );

    } finally {
      if (authorizationController === controller) {
        authorizationController = null;
      }
    }
  }

  // ==========================================================
  // 9. AUTHENTICATED STATE
  // ==========================================================

  function showAuthenticatedState() {
    lockDashboard();

    void verifyAdministratorAccess();
  }

  // ==========================================================
  // 10. UPDATE AUTHENTICATION INTERFACE
  // ==========================================================

  function updateAuthInterface() {
    lockDashboard();

    if (!cognitoFunctionsAvailable()) {
      cancelPendingAuthorization();

      setAuthMessage(
        "Authentication services are unavailable. " +
        "Please refresh the page."
      );

      setLoginButtonState({
        disabled: true,
        loading: false
      });

      return;
    }

    if (isCognitoAuthenticated()) {
      showAuthenticatedState();
    } else {
      showSignedOutState();
    }
  }

  // ==========================================================
  // 11. START ADMIN LOGIN
  // ==========================================================

  async function startAdminLogin() {
    if (!cognitoFunctionsAvailable()) {
      setAuthMessage(
        "Amazon Cognito is not available. " +
        "Please refresh the page."
      );

      return;
    }

    if (
      adminLoginBtn &&
      adminLoginBtn.disabled
    ) {
      return;
    }

    cancelPendingAuthorization();

    lockDashboard();

    setAuthMessage(
      "Preparing your secure Amazon Cognito " +
      "sign-in session..."
    );

    setLoginButtonState({
      disabled: true,
      loading: true
    });

    try {
      const started =
        await loginAdminWithCognito();

      if (started === false) {
        setAuthMessage(
          "Unable to start sign-in. " +
          "Please try again."
        );

        setLoginButtonState({
          disabled: false,
          loading: false
        });
      }

    } catch (error) {
      console.error(
        "[Admin] Unable to start Cognito login:",
        error
      );

      setAuthMessage(
        "An error occurred while starting sign-in. " +
        "Please try again."
      );

      setLoginButtonState({
        disabled: false,
        loading: false
      });
    }
  }

  // ==========================================================
  // 12. CONNECT LOGIN BUTTON
  // ==========================================================

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener(
      "click",
      startAdminLogin
    );
  } else {
    console.error(
      "[Admin] Login button was not found."
    );
  }

  // ==========================================================
  // 13. CONNECT LOGOUT BUTTON
  // ==========================================================

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener(
      "click",
      () => {
        cancelPendingAuthorization();

        lockDashboard();

        if (
          typeof logoutWithCognito === "function"
        ) {
          logoutWithCognito();
        } else {
          console.error(
            "[Admin] Cognito logout is unavailable."
          );
        }
      }
    );
  }

  // ==========================================================
  // 14. AUTHENTICATION CHANGE EVENT
  // ==========================================================

  window.addEventListener(
    "portfolio:auth-changed",
    () => {
      updateAuthInterface();
    }
  );

  // ==========================================================
  // 15. INITIALIZE ADMIN DASHBOARD
  // ==========================================================

  async function initializeAdminDashboard() {
    lockDashboard();

    setAuthMessage(
      "Checking your secure authentication session..."
    );

    setLoginButtonState({
      disabled: true,
      loading: false
    });

    if (!cognitoFunctionsAvailable()) {
      updateAuthInterface();
      return;
    }

    try {
      await waitForCognitoInitialization();

      updateAuthInterface();

      console.info(
        "[Admin] Authentication controller initialized."
      );

    } catch (error) {
      console.error(
        "[Admin] Authentication initialization failed:",
        error
      );

      cancelPendingAuthorization();

      lockDashboard();

      setAuthMessage(
        "Unable to verify the authentication session. " +
        "Please refresh the page."
      );

      setLoginButtonState({
        disabled: true,
        loading: false
      });
    }
  }

  // ==========================================================
  // 16. START ADMIN CONTROLLER
  // ==========================================================

  void initializeAdminDashboard();

});
