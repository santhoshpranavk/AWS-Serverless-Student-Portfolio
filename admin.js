
"use strict";

/*
 * ============================================================
 * PRANAV K — AWS CLOUD.DEV ADMIN CONSOLE
 *
 * File: admin.js
 *
 * Amazon Cognito Authentication Controller
 *
 * SECURITY:
 * - Cognito authenticates the user.
 * - Authentication does not grant admin rights.
 * - Dashboard stays hidden until the AWS Lambda
 *   backend verifies administrator permissions.
 * - Never expose access tokens in console logs.
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================================
  // 1. GET DASHBOARD ELEMENTS
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

  // ==========================================================
  // 2. INITIAL SECURITY STATE
  // ==========================================================

  // Dashboard is never unlocked merely because
  // a Cognito access token exists in the browser.

  function lockDashboard() {
    if (adminApp) {
      adminApp.hidden = true;
    }

    if (authGate) {
      authGate.hidden = false;
    }
  }

  lockDashboard();

  // ==========================================================
  // 3. DISPLAY STATUS MESSAGES
  // ==========================================================

  function setAuthMessage(message) {
    if (!authGateMessage) {
      return;
    }

    authGateMessage.textContent = message;
  }

  // ==========================================================
  // 4. LOGIN BUTTON STATE
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
  // 5. CHECK COGNITO AVAILABILITY
  // ==========================================================

  function cognitoFunctionsAvailable() {
    return (
      typeof loginAdminWithCognito === "function" &&
      typeof isCognitoAuthenticated === "function" &&
      typeof waitForCognitoInitialization === "function"
    );
  }

  // ==========================================================
  // 6. DISPLAY SIGNED-OUT STATE
  // ==========================================================

  function showSignedOutState() {
    lockDashboard();

    setAuthMessage(
      "Securely sign in with Amazon Cognito " +
      "to verify your identity and continue."
    );

    setLoginButtonState({
      disabled: false,
      loading: false
    });
  }

  // ==========================================================
  // 7. DISPLAY AUTHENTICATED STATE
  // ==========================================================

  function showAuthenticatedState() {
    lockDashboard();

    setAuthMessage(
      "Amazon Cognito sign-in completed successfully. " +
      "Administrator authorization is not configured yet, " +
      "so dashboard access remains restricted."
    );

    // Hide the login button after authentication.
    // A verified admin session will be handled later
    // through a protected Lambda authorization endpoint.

    if (adminLoginBtn) {
      adminLoginBtn.hidden = true;
      adminLoginBtn.disabled = true;
    }

    console.info(
      "[Admin] Cognito authentication completed. " +
      "Backend administrator authorization is required."
    );
  }

  // ==========================================================
  // 8. UPDATE AUTHENTICATION INTERFACE
  // ==========================================================

  function updateAuthInterface() {
    lockDashboard();

    if (!cognitoFunctionsAvailable()) {
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
      if (adminLoginBtn) {
        adminLoginBtn.hidden = false;
      }

      showSignedOutState();
    }
  }

  // ==========================================================
  // 9. START ADMIN LOGIN
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

      // Normally the browser navigates to Cognito.
      // If navigation fails or the function returns
      // without redirecting, restore the interface.

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
  // 10. CONNECT LOGIN BUTTON
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
  // 11. CONNECT LOGOUT BUTTON
  // ==========================================================

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener(
      "click",
      () => {
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
  // 12. LISTEN FOR COGNITO AUTH CHANGES
  // ==========================================================

  window.addEventListener(
    "portfolio:auth-changed",
    () => {
      updateAuthInterface();
    }
  );

  // ==========================================================
  // 13. WAIT FOR AUTHENTICATION INITIALIZATION
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
  // 14. START DASHBOARD CONTROLLER
  // ==========================================================

  void initializeAdminDashboard();

});
