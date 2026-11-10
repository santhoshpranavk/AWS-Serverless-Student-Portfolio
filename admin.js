
"use strict";

/*
 * AWS SERVERLESS STUDENT PORTFOLIO
 * Administrator Dashboard Controller
 *
 * Authentication: Amazon Cognito
 * Authorization: AWS Lambda /api/admin/me
 * Database: Amazon DynamoDB via Lambda
 *
 * Features:
 * - Secure administrator authentication
 * - Project and blog statistics
 * - Project CRUD
 * - Blog CRUD
 * - Draft and published blog management
 * - Error handling and confirmation dialogs
 *
 * IMPORTANT:
 * Backend authorization is mandatory.
 * Hiding frontend controls is not a security boundary.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ============================================================
  // 1. CONFIGURATION
  // ============================================================

  const API_BASE =
    "https://90y9wzfm46tg51xd.qws.lambda-web.ap-south-1.on.aws";

  const ENDPOINTS = {
    auth: `${API_BASE}/api/admin/me`,
    projects: `${API_BASE}/api/admin/projects`,
    blog: `${API_BASE}/api/admin/blog`
  };

  const PROJECT_STATUSES = [
    "Planned",
    "In Progress",
    "Completed",
    "On Hold",
    "Live"
  ];

  const BLOG_STATUSES = [
    "draft",
    "published"
  ];

  // ============================================================
  // 2. ELEMENT REFERENCES
  // ============================================================

  const elements = {
    adminApp: document.getElementById("adminApp"),
    authGate: document.getElementById("authGate"),
    authGateMessage:
      document.getElementById("authGateMessage"),
    loginButton:
      document.getElementById("adminLoginBtn"),
    logoutButton:
      document.getElementById("adminLogoutBtn"),
    totalProjects:
      document.getElementById("totalProjects"),
    totalBlogPosts:
      document.getElementById("totalBlogPosts"),
    projectsContainer:
      document.getElementById("adminProjects"),
    blogContainer:
      document.getElementById("adminBlogPosts")
  };

  // ============================================================
  // 3. APPLICATION STATE
  // ============================================================

  const state = {
    authorized: false,
    projects: [],
    posts: [],
    editingProject: null,
    editingPost: null,
    busy: false,
    generation: 0,
    controller: null
  };

  // ============================================================
  // 4. AUTHENTICATION HELPERS
  // ============================================================

  function cognitoAvailable() {
    return (
      typeof loginAdminWithCognito === "function" &&
      typeof logoutWithCognito === "function" &&
      typeof isCognitoAuthenticated === "function" &&
      typeof getCognitoAccessToken === "function" &&
      typeof waitForCognitoInitialization === "function"
    );
  }

  function getToken() {
    if (!cognitoAvailable()) {
      return null;
    }

    if (!isCognitoAuthenticated()) {
      return null;
    }

    return getCognitoAccessToken() || null;
  }

  function currentSession(generation, token) {
    return (
      generation === state.generation &&
      state.authorized &&
      !elements.adminApp.hidden &&
      isCognitoAuthenticated() &&
      getCognitoAccessToken() === token
    );
  }

  function resetDashboard() {
    state.projects = [];
    state.posts = [];
    state.editingProject = null;
    state.editingPost = null;
    state.busy = false;

    if (elements.totalProjects) {
      elements.totalProjects.textContent = "--";
    }

    if (elements.totalBlogPosts) {
      elements.totalBlogPosts.textContent = "--";
    }

    if (elements.projectsContainer) {
      elements.projectsContainer.replaceChildren();
    }

    if (elements.blogContainer) {
      elements.blogContainer.replaceChildren();
    }
  }

  function lockDashboard() {
    state.authorized = false;

    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }

    state.generation += 1;

    if (elements.adminApp) {
      elements.adminApp.hidden = true;
    }

    if (elements.authGate) {
      elements.authGate.hidden = false;
    }

    resetDashboard();
  }

  function unlockDashboard() {
    if (elements.authGate) {
      elements.authGate.hidden = true;
    }

    if (elements.adminApp) {
      elements.adminApp.hidden = false;
    }

    state.authorized = true;
  }

  function setAuthMessage(message) {
    if (elements.authGateMessage) {
      elements.authGateMessage.textContent = message;
    }
  }

  function setLoginButton(disabled, loading = false) {
    const button = elements.loginButton;

    if (!button) {
      return;
    }

    button.disabled = disabled;
    button.hidden = false;
    button.setAttribute("aria-busy", String(loading));

    button.textContent = loading
      ? "Redirecting to Amazon Cognito..."
      : "Login with Amazon Cognito";
  }

  // ============================================================
  // 5. API HELPER
  // ============================================================

  async function apiRequest(
    url,
    {
      method = "GET",
      body,
      signal
    } = {}
  ) {
    if (!state.authorized) {
      throw new Error("Administrator access is not verified.");
    }

    const token = getToken();

    if (!token) {
      throw new Error(
        "Your login session has expired. Please sign in again."
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers,
      body: body === undefined
        ? undefined
        : JSON.stringify(body),
      signal
    });

    let result = null;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        `Server returned an invalid response (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        lockDashboard();

        setAuthMessage(
          "Your session has expired. Please sign in again."
        );

        throw new Error("Authentication expired.");
      }

      if (response.status === 403) {
        lockDashboard();

        setAuthMessage(
          "Access denied. Administrator permission is required."
        );

        throw new Error("Administrator access denied.");
      }

      throw new Error(
        result?.message ||
        `Request failed with HTTP ${response.status}.`
      );
    }

    if (result?.status === "error") {
      throw new Error(
        result.message || "The operation failed."
      );
    }

    return result;
  }

  // ============================================================
  // 6. DOM HELPERS
  // ============================================================

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function createButton(label, handler, className = "") {
    const button = createElement(
      "button",
      className,
      label
    );

    button.type = "button";
    button.disabled = state.busy;

    button.addEventListener("click", handler);

    return button;
  }

  function createMessage(text, isError = false) {
    const message = createElement(
      "p",
      isError
        ? "admin-message admin-error"
        : "admin-message admin-success",
      text
    );

    message.setAttribute("role", "status");

    return message;
  }

  function showContainerMessage(
    container,
    text,
    isError = false
  ) {
    if (!container) {
      return;
    }

    const existing =
      container.querySelector(".admin-message");

    if (existing) {
      existing.remove();
    }

    container.prepend(
      createMessage(text, isError)
    );
  }

  function createField(
    labelText,
    name,
    value = "",
    {
      multiline = false,
      required = true,
      maxLength = 5000
    } = {}
  ) {
    const wrapper = createElement(
      "label",
      "admin-form-field"
    );

    const label = createElement(
      "span",
      "admin-field-label",
      labelText
    );

    const input = document.createElement(
      multiline ? "textarea" : "input"
    );

    if (!multiline) {
      input.type = "text";
    } else {
      input.rows = 5;
    }

    input.name = name;
    input.value = value ?? "";
    input.required = required;
    input.maxLength = maxLength;

    wrapper.append(label, input);

    return wrapper;
  }

  function createSelect(
    labelText,
    name,
    options,
    selected
  ) {
    const wrapper = createElement(
      "label",
      "admin-form-field"
    );

    wrapper.append(
      createElement(
        "span",
        "admin-field-label",
        labelText
      )
    );

    const select = document.createElement("select");
    select.name = name;

    for (const optionValue of options) {
      const option = document.createElement("option");

      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = optionValue === selected;

      select.append(option);
    }

    wrapper.append(select);

    return wrapper;
  }

  function createActions() {
    return createElement("div", "admin-actions");
  }

  function createCard(title, description) {
    const card = createElement(
      "article",
      "admin-record-card"
    );

    card.append(
      createElement("h3", "", title),
      createElement("p", "", description)
    );

    return card;
  }

  function getFormValue(form, name) {
    return String(
      new FormData(form).get(name) || ""
    ).trim();
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function setBusy(busy) {
    state.busy = busy;

    if (!elements.adminApp) {
      return;
    }

    elements.adminApp
      .querySelectorAll(
        "#adminProjects button, #adminBlogPosts button"
      )
      .forEach(button => {
        button.disabled = busy;
      });
  }

  // ============================================================
  // 7. LOAD PROJECTS AND BLOG POSTS
  // ============================================================

  function extractArray(result, keys) {
    for (const key of keys) {
      if (Array.isArray(result?.[key])) {
        return result[key];
      }
    }

    throw new Error(
      "The API response did not contain the expected list."
    );
  }

  async function loadDashboardData() {
    if (!state.authorized) {
      return;
    }

    const generation = state.generation;
    const token = getToken();

    if (!token) {
      return;
    }

    if (elements.totalProjects) {
      elements.totalProjects.textContent = "...";
    }

    if (elements.totalBlogPosts) {
      elements.totalBlogPosts.textContent = "...";
    }

    try {
      const [projectsResult, blogResult] =
        await Promise.all([
          apiRequest(ENDPOINTS.projects),
          apiRequest(ENDPOINTS.blog)
        ]);

      if (!currentSession(generation, token)) {
        return;
      }

      state.projects = extractArray(
        projectsResult,
        ["projects", "items"]
      );

      state.posts = extractArray(
        blogResult,
        ["posts", "items"]
      );

      renderStatistics();
      renderProjects();
      renderBlogPosts();

      console.info(
        "[Admin] Dashboard data loaded successfully."
      );

    } catch (error) {
      if (!currentSession(generation, token)) {
        return;
      }

      if (elements.totalProjects) {
        elements.totalProjects.textContent = "Error";
      }

      if (elements.totalBlogPosts) {
        elements.totalBlogPosts.textContent = "Error";
      }

      showContainerMessage(
        elements.projectsContainer,
        error.message,
        true
      );

      showContainerMessage(
        elements.blogContainer,
        error.message,
        true
      );

      console.error(
        "[Admin] Failed to load dashboard:",
        error.message
      );
    }
  }

  function renderStatistics() {
    if (elements.totalProjects) {
      elements.totalProjects.textContent =
        String(state.projects.length);
    }

    if (elements.totalBlogPosts) {
      elements.totalBlogPosts.textContent =
        String(state.posts.length);
    }
  }

  // ============================================================
  // 8. PROJECT LIST
  // ============================================================

  function renderProjects() {
    const container = elements.projectsContainer;

    if (!container) {
      return;
    }

    container.replaceChildren();

    const toolbar = createActions();

    toolbar.append(
      createButton(
        "+ Add Project",
        () => showProjectForm(),
        "admin-primary-btn"
      ),
      createButton(
        "Refresh",
        () => void loadDashboardData(),
        "admin-secondary-btn"
      )
    );

    container.append(toolbar);

    if (state.editingProject !== null) {
      container.append(
        buildProjectForm(state.editingProject)
      );
    }

    if (state.projects.length === 0) {
      container.append(
        createElement(
          "p",
          "admin-empty-state",
          "No projects found. Create your first project."
        )
      );

      return;
    }

    const list = createElement(
      "div",
      "admin-record-list"
    );

    for (const project of state.projects) {
      const card = createCard(
        project.title || "Untitled Project",
        project.description || "No description"
      );

      card.append(
        createElement(
          "p",
          "admin-record-meta",
          `ID: ${project.projectId || "Unknown"}`
        ),
        createElement(
          "p",
          "admin-record-meta",
          `Status: ${project.status || "Unknown"}`
        ),
        createElement(
          "p",
          "admin-record-meta",
          `Technologies: ${
            Array.isArray(project.technologies)
              ? project.technologies.join(", ")
              : "None"
          }`
        )
      );

      const actions = createActions();

      actions.append(
        createButton(
          "Edit",
          () => showProjectForm(project),
          "admin-secondary-btn"
        ),
        createButton(
          "Delete",
          () => void deleteProject(project),
          "admin-danger-btn"
        )
      );

      card.append(actions);
      list.append(card);
    }

    container.append(list);
  }

  // ============================================================
  // 9. PROJECT FORM
  // ============================================================

  function showProjectForm(project = null) {
    state.editingProject = project || {};

    renderProjects();

    const form =
      elements.projectsContainer.querySelector(
        ".admin-project-form"
      );

    form?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function buildProjectForm(project) {
    const editing = Boolean(project.projectId);

    const form = createElement(
      "form",
      "admin-editor-form admin-project-form"
    );

    form.append(
      createElement(
        "h3",
        "",
        editing ? "Edit Project" : "Create Project"
      ),
      createField(
        "Project Title",
        "title",
        project.title || "",
        { maxLength: 200 }
      ),
      createField(
        "Description",
        "description",
        project.description || "",
        {
          multiline: true,
          maxLength: 5000
        }
      ),
      createField(
        "GitHub URL",
        "githubUrl",
        project.githubUrl || "",
        {
          required: false,
          maxLength: 500
        }
      ),
      createField(
        "Technologies (comma-separated)",
        "technologies",
        Array.isArray(project.technologies)
          ? project.technologies.join(", ")
          : "",
        { maxLength: 1000 }
      ),
      createSelect(
        "Project Status",
        "status",
        PROJECT_STATUSES,
        project.status || "Planned"
      )
    );

    const actions = createActions();

    const saveButton = createButton(
      editing ? "Save Changes" : "Create Project",
      () => {},
      "admin-primary-btn"
    );

    saveButton.type = "submit";

    const cancelButton = createButton(
      "Cancel",
      () => {
        state.editingProject = null;
        renderProjects();
      },
      "admin-secondary-btn"
    );

    actions.append(saveButton, cancelButton);
    form.append(actions);

    form.addEventListener("submit", event => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      void saveProject(form, project);
    });

    return form;
  }

  async function saveProject(form, project) {
    if (state.busy) {
      return;
    }

    const editing = Boolean(project.projectId);

    const technologies = getFormValue(
      form,
      "technologies"
    )
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);

    if (technologies.length > 30) {
      alert("Maximum 30 technologies are allowed.");
      return;
    }

    if (technologies.some(value => value.length > 100)) {
      alert("Each technology name must be 100 characters or less.");
      return;
    }

    const githubUrl = getFormValue(
      form,
      "githubUrl"
    );

    if (githubUrl) {
      try {
        const url = new URL(githubUrl);

        if (
          url.protocol !== "https:" ||
          url.hostname !== "github.com"
        ) {
          throw new Error("Invalid GitHub URL.");
        }
      } catch {
        alert(
          "Enter a valid https://github.com/... URL."
        );
        return;
      }
    }

    const body = {
      title: getFormValue(form, "title"),
      description: getFormValue(form, "description"),
      githubUrl,
      technologies,
      status: getFormValue(form, "status")
    };

    if (!editing) {
      body.projectId = createId("project");
    }

    const generation = state.generation;
    const token = getToken();

    setBusy(true);

    try {
      await apiRequest(
        editing
          ? `${ENDPOINTS.projects}/${encodeURIComponent(project.projectId)}`
          : ENDPOINTS.projects,
        {
          method: editing ? "PUT" : "POST",
          body
        }
      );

      if (!currentSession(generation, token)) {
        return;
      }

      state.editingProject = null;

      await loadDashboardData();

      if (currentSession(generation, token)) {
        showContainerMessage(
          elements.projectsContainer,
          editing
            ? "Project updated successfully."
            : "Project created successfully."
        );
      }

    } catch (error) {
      if (currentSession(generation, token)) {
        alert(`Unable to save project: ${error.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // 10. DELETE PROJECT
  // ============================================================

  async function deleteProject(project) {
    if (state.busy) {
      return;
    }

    const confirmed = confirm(
      `Permanently delete project "${project.title}"?\n\n` +
      `Project ID: ${project.projectId}\n\n` +
      "This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const generation = state.generation;
    const token = getToken();

    setBusy(true);

    try {
      await apiRequest(
        `${ENDPOINTS.projects}/${encodeURIComponent(project.projectId)}`,
        { method: "DELETE" }
      );

      if (!currentSession(generation, token)) {
        return;
      }

      state.editingProject = null;

      await loadDashboardData();

      if (currentSession(generation, token)) {
        showContainerMessage(
          elements.projectsContainer,
          "Project deleted successfully."
        );
      }

    } catch (error) {
      if (currentSession(generation, token)) {
        alert(
          `Unable to delete project: ${error.message}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // 11. BLOG LIST
  // ============================================================

  function renderBlogPosts() {
    const container = elements.blogContainer;

    if (!container) {
      return;
    }

    container.replaceChildren();

    const toolbar = createActions();

    toolbar.append(
      createButton(
        "+ New Blog Post",
        () => showBlogForm(),
        "admin-primary-btn"
      ),
      createButton(
        "Refresh",
        () => void loadDashboardData(),
        "admin-secondary-btn"
      )
    );

    container.append(toolbar);

    if (state.editingPost !== null) {
      container.append(
        buildBlogForm(state.editingPost)
      );
    }

    if (state.posts.length === 0) {
      container.append(
        createElement(
          "p",
          "admin-empty-state",
          "No blog posts found. Create your first post."
        )
      );

      return;
    }

    const list = createElement(
      "div",
      "admin-record-list"
    );

    for (const post of state.posts) {
      const preview = String(post.content || "");

      const card = createCard(
        post.title || "Untitled Post",
        preview.length > 220
          ? `${preview.slice(0, 220)}...`
          : preview
      );

      card.append(
        createElement(
          "p",
          "admin-record-meta",
          `ID: ${post.postId || "Unknown"}`
        ),
        createElement(
          "p",
          "admin-record-meta",
          `Status: ${post.status || "Unknown"}`
        ),
        createElement(
          "p",
          "admin-record-meta",
          `Created: ${post.createdAt || "Unknown"}`
        )
      );

      const actions = createActions();

      actions.append(
        createButton(
          "Edit",
          () => showBlogForm(post),
          "admin-secondary-btn"
        ),
        createButton(
          "Delete",
          () => void deleteBlogPost(post),
          "admin-danger-btn"
        )
      );

      card.append(actions);
      list.append(card);
    }

    container.append(list);
  }

  // ============================================================
  // 12. BLOG FORM
  // ============================================================

  function showBlogForm(post = null) {
    state.editingPost = post || {};

    renderBlogPosts();

    const form =
      elements.blogContainer.querySelector(
        ".admin-blog-form"
      );

    form?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function buildBlogForm(post) {
    const editing = Boolean(post.postId);

    const form = createElement(
      "form",
      "admin-editor-form admin-blog-form"
    );

    form.append(
      createElement(
        "h3",
        "",
        editing ? "Edit Blog Post" : "Create Blog Post"
      ),
      createField(
        "Blog Title",
        "title",
        post.title || "",
        { maxLength: 200 }
      ),
      createField(
        "Blog Content",
        "content",
        post.content || "",
        {
          multiline: true,
          maxLength: 50000
        }
      ),
      createSelect(
        "Publication Status",
        "status",
        BLOG_STATUSES,
        post.status || "draft"
      )
    );

    const actions = createActions();

    const saveButton = createButton(
      editing ? "Save Changes" : "Create Blog Post",
      () => {},
      "admin-primary-btn"
    );

    saveButton.type = "submit";

    const cancelButton = createButton(
      "Cancel",
      () => {
        state.editingPost = null;
        renderBlogPosts();
      },
      "admin-secondary-btn"
    );

    actions.append(saveButton, cancelButton);
    form.append(actions);

    form.addEventListener("submit", event => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      void saveBlogPost(form, post);
    });

    return form;
  }

  async function saveBlogPost(form, post) {
    if (state.busy) {
      return;
    }

    const editing = Boolean(post.postId);

    const body = {
      title: getFormValue(form, "title"),
      content: getFormValue(form, "content"),
      status: getFormValue(form, "status")
    };

    if (!editing) {
      body.postId = createId("post");
    }

    if (
      body.status === "published" &&
      !confirm(
        "Publish this blog post?\n\n" +
        "Published posts can appear on your public website."
      )
    ) {
      return;
    }

    const generation = state.generation;
    const token = getToken();

    setBusy(true);

    try {
      await apiRequest(
        editing
          ? `${ENDPOINTS.blog}/${encodeURIComponent(post.postId)}`
          : ENDPOINTS.blog,
        {
          method: editing ? "PUT" : "POST",
          body
        }
      );

      if (!currentSession(generation, token)) {
        return;
      }

      state.editingPost = null;

      await loadDashboardData();

      if (currentSession(generation, token)) {
        showContainerMessage(
          elements.blogContainer,
          editing
            ? "Blog post updated successfully."
            : "Blog post created successfully."
        );
      }

    } catch (error) {
      if (currentSession(generation, token)) {
        alert(
          `Unable to save blog post: ${error.message}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // 13. DELETE BLOG POST
  // ============================================================

  async function deleteBlogPost(post) {
    if (state.busy) {
      return;
    }

    const confirmed = confirm(
      `Permanently delete blog post "${post.title}"?\n\n` +
      `Post ID: ${post.postId}\n\n` +
      "This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const generation = state.generation;
    const token = getToken();

    setBusy(true);

    try {
      await apiRequest(
        `${ENDPOINTS.blog}/${encodeURIComponent(post.postId)}`,
        { method: "DELETE" }
      );

      if (!currentSession(generation, token)) {
        return;
      }

      state.editingPost = null;

      await loadDashboardData();

      if (currentSession(generation, token)) {
        showContainerMessage(
          elements.blogContainer,
          "Blog post deleted successfully."
        );
      }

    } catch (error) {
      if (currentSession(generation, token)) {
        alert(
          `Unable to delete blog post: ${error.message}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // 14. VERIFY ADMINISTRATOR ACCESS
  // ============================================================

  async function verifyAdministratorAccess() {
    lockDashboard();

    if (!cognitoAvailable()) {
      setAuthMessage(
        "Authentication services are unavailable."
      );
      return;
    }

    const token = getToken();

    if (!token) {
      showSignedOutState();
      return;
    }

    const generation = state.generation;
    const controller = new AbortController();

    state.controller = controller;

    if (elements.loginButton) {
      elements.loginButton.hidden = true;
    }

    setAuthMessage(
      "Verifying administrator permissions with AWS..."
    );

    try {
      const response = await fetch(
        ENDPOINTS.auth,
        {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          },
          signal: controller.signal
        }
      );

      const result = await response.json();

      if (
        generation !== state.generation ||
        controller.signal.aborted ||
        getToken() !== token
      ) {
        return;
      }

      const authorized =
        response.ok &&
        result?.status === "success" &&
        result?.authorized === true &&
        result?.role === "PortfolioAdmins";

      if (!authorized) {
        lockDashboard();

        if (response.status === 401) {
          setAuthMessage(
            "Your session has expired. Please sign in again."
          );
        } else if (response.status === 403) {
          setAuthMessage(
            "Access denied. PortfolioAdmins permission is required."
          );
        } else {
          setAuthMessage(
            "Administrator authorization could not be verified."
          );
        }

        setLoginButton(false);
        return;
      }

      unlockDashboard();

      console.info(
        "[Admin] Administrator authorization verified."
      );

      void loadDashboardData();

    } catch (error) {
      if (
        generation !== state.generation ||
        controller.signal.aborted
      ) {
        return;
      }

      lockDashboard();

      setAuthMessage(
        "Unable to verify administrator access. Please try again."
      );

      setLoginButton(false);

      console.error(
        "[Admin] Authorization request failed:",
        error.message
      );

    } finally {
      if (state.controller === controller) {
        state.controller = null;
      }
    }
  }

  // ============================================================
  // 15. SIGNED-OUT STATE
  // ============================================================

  function showSignedOutState() {
    lockDashboard();

    setAuthMessage(
      "Securely sign in with Amazon Cognito to continue."
    );

    setLoginButton(false);
  }

  // ============================================================
  // 16. LOGIN
  // ============================================================

  async function startAdminLogin() {
    if (!cognitoAvailable()) {
      setAuthMessage(
        "Amazon Cognito is unavailable. Please refresh."
      );
      return;
    }

    if (elements.loginButton?.disabled) {
      return;
    }

    lockDashboard();

    setAuthMessage(
      "Preparing secure Amazon Cognito sign-in..."
    );

    setLoginButton(true, true);

    try {
      const started = await loginAdminWithCognito();

      if (started === false) {
        setAuthMessage(
          "Unable to start sign-in. Please try again."
        );

        setLoginButton(false);
      }

    } catch (error) {
      setAuthMessage(
        "An error occurred while starting sign-in."
      );

      setLoginButton(false);

      console.error(
        "[Admin] Login failed:",
        error.message
      );
    }
  }

  // ============================================================
  // 17. LOGOUT
  // ============================================================

  function startAdminLogout() {
    lockDashboard();

    setAuthMessage("Signing out...");

    if (typeof logoutWithCognito === "function") {
      logoutWithCognito();
    } else {
      showSignedOutState();
    }
  }

  // ============================================================
  // 18. AUTHENTICATION EVENTS
  // ============================================================

  if (elements.loginButton) {
    elements.loginButton.addEventListener(
      "click",
      startAdminLogin
    );
  }

  if (elements.logoutButton) {
    elements.logoutButton.addEventListener(
      "click",
      startAdminLogout
    );
  }

  window.addEventListener(
    "portfolio:auth-changed",
    () => {
      if (getToken()) {
        void verifyAdministratorAccess();
      } else {
        showSignedOutState();
      }
    }
  );

  // ============================================================
  // 19. INITIALIZATION
  // ============================================================

  async function initializeDashboard() {
    lockDashboard();

    setAuthMessage(
      "Checking your secure authentication session..."
    );

    setLoginButton(true);

    if (!cognitoAvailable()) {
      setAuthMessage(
        "Authentication services are unavailable. Refresh the page."
      );
      return;
    }

    try {
      await waitForCognitoInitialization();

      if (getToken()) {
        await verifyAdministratorAccess();
      } else {
        showSignedOutState();
      }

      console.info(
        "[Admin] Dashboard controller initialized."
      );

    } catch (error) {
      lockDashboard();

      setAuthMessage(
        "Authentication initialization failed. Please refresh."
      );

      console.error(
        "[Admin] Initialization failed:",
        error.message
      );
    }
  }

  void initializeDashboard();
});
