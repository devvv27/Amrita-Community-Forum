const SKILLS = [
  "React",
  "Node.js",
  "Python",
  "Data Structures",
  "Machine Learning",
  "UI/UX",
  "Cloud",
  "DevOps",
  "Cybersecurity",
  "Technical Writing"
];

const TASK_STATUSES = ["Open", "In Negotiation", "In Progress", "Completed", "Disputed"];

const DEFAULT_TASKS = [
  {
    id: crypto.randomUUID(),
    title: "Build Student Event Calendar",
    description: "Need help integrating event reminders and category filters.",
    tags: ["React", "Node.js"],
    techStack: "React, Node.js, PostgreSQL",
    owner: "campus_admin",
    difficulty: "Medium",
    budget: 18000,
    deadline: "2026-05-20",
    status: "Open",
    applications: [
      {
        id: crypto.randomUUID(),
        applicant: "solver_maya",
        proposal: "I can deliver in two milestones with test coverage and deployment notes.",
        proposedBudget: 17500,
        createdAt: new Date().toISOString()
      }
    ],
    rating: null
  },
  {
    id: crypto.randomUUID(),
    title: "Optimize Python Attendance Analyzer",
    description: "Improve runtime for large CSV imports and report generation.",
    tags: ["Python", "Data Structures"],
    techStack: "Python, Pandas, NumPy",
    owner: "faculty_ai_lab",
    difficulty: "High",
    budget: 25000,
    deadline: "2026-05-10",
    status: "In Progress",
    applications: [],
    rating: null
  },
  {
    id: crypto.randomUUID(),
    title: "Design Fresh Landing Visuals",
    description: "Looking for UI/UX support for the alumni portal revamp.",
    tags: ["UI/UX"],
    techStack: "Figma, CSS, Accessibility",
    owner: "design_club",
    difficulty: "Low",
    budget: 9000,
    deadline: "2026-04-20",
    status: "Completed",
    applications: [],
    rating: 4.4
  },
  {
    id: crypto.randomUUID(),
    title: "Secure Club Management API",
    description: "Add role-based auth and abuse throttling for club operations APIs.",
    tags: ["Node.js", "Cybersecurity", "Cloud"],
    techStack: "Node.js, JWT, Redis",
    owner: "it_services",
    difficulty: "High",
    budget: 30000,
    deadline: "2026-06-01",
    status: "Disputed",
    applications: [],
    rating: 2.5
  }
];

const DEFAULT_NEWS = [
  {
    title: "AI assistants are reshaping software delivery workflows",
    source: "Tech Digest",
    category: "AI",
    summary: "Teams are using AI copilots for testing, refactoring, and documentation automation.",
    trendingScore: 88
  },
  {
    title: "Zero trust security gains traction in universities",
    source: "Cyber Campus Weekly",
    category: "Security",
    summary: "Institutions are redesigning network access policies to protect distributed research labs.",
    trendingScore: 91
  },
  {
    title: "Cloud native dev tools reduce onboarding time",
    source: "Engineering Daily",
    category: "Cloud",
    summary: "New cloud IDE and container approaches are improving first-week developer productivity.",
    trendingScore: 84
  },
  {
    title: "Design systems shift toward accessibility-first components",
    source: "Frontend Gazette",
    category: "UI/UX",
    summary: "Teams are measuring component libraries by accessibility outcomes and reuse quality.",
    trendingScore: 77
  }
];

const TRENDING_DISCUSSIONS = [
  { topic: "Are AI code reviews replacing traditional review gates?", replies: 42 },
  { topic: "Best way to budget student-led cloud projects", replies: 28 },
  { topic: "Should security testing be mandatory before peer deployment?", replies: 35 }
];

const STORAGE_KEYS = {
  users: "acf_users",
  session: "acf_session",
  tasks: "acf_tasks"
};

const state = {
  activeView: "dashboard",
  authIntent: "dashboard",
  users: normalizeUsers(JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || "[]")),
  session: JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null"),
  tasks: normalizeTasks(JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || "null") || DEFAULT_TASKS),
  taskFormMode: "create",
  editingTaskId: null,
  browse: {
    tag: "All",
    difficulty: "All",
    budget: "All",
    selectedTaskId: null
  },
  newsCategory: "All",
  profileSavedAt: null
};

const app = document.getElementById("app");
const nav = document.getElementById("mainNav");
const authBtn = document.getElementById("authBtn");
const newTaskBtn = document.getElementById("newTaskBtn");
const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const toastEl = document.getElementById("toast");

const forms = {
  login: document.getElementById("loginForm"),
  register: document.getElementById("registerForm"),
  forgot: document.getElementById("forgotForm")
};

init();

function init() {
  persist();
  renderRegisterSkillTags();
  bindAuthHandlers();
  bindHeaderActions();
  render();
}

function normalizeUsers(users) {
  return (users || []).map((user) => ({
    ...user,
    skills: Array.isArray(user.skills) ? user.skills : [],
    reputation: typeof user.reputation === "number" ? user.reputation : 10,
    joinedAt: user.joinedAt || new Date().toISOString()
  }));
}

function normalizeTasks(tasks) {
  return (tasks || []).map((task) => ({
    id: task.id || crypto.randomUUID(),
    title: task.title || "Untitled task",
    description: task.description || "",
    tags: Array.isArray(task.tags) ? task.tags : [],
    techStack: task.techStack || (Array.isArray(task.tags) ? task.tags.join(", ") : "General"),
    owner: task.owner || "unknown",
    difficulty: task.difficulty || "Medium",
    budget: Number(task.budget) || 0,
    deadline: task.deadline || "",
    status: TASK_STATUSES.includes(task.status) ? task.status : "Open",
    applications: Array.isArray(task.applications) ? task.applications : [],
    rating: typeof task.rating === "number" ? task.rating : null
  }));
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(state.users));
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
}

function bindHeaderActions() {
  authBtn.addEventListener("click", () => {
    if (state.session) {
      logout();
      return;
    }
    openAuthModal("login");
  });

  newTaskBtn.addEventListener("click", () => {
    if (!state.session) {
      state.authIntent = "myTasks";
      toast("Login required to create tasks");
      openAuthModal("login");
      return;
    }
    state.activeView = "myTasks";
    state.taskFormMode = "create";
    state.editingTaskId = null;
    render();
    const createTaskForm = document.getElementById("createTaskForm");
    if (createTaskForm) createTaskForm.scrollIntoView({ behavior: "smooth" });
  });

  closeAuthModal.addEventListener("click", closeModal);
  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) closeModal();
  });
}

function bindAuthHandlers() {
  document.getElementById("showLogin").addEventListener("click", () => toggleAuthView("login"));
  document.getElementById("showRegister").addEventListener("click", () => toggleAuthView("register"));
  document.getElementById("showForgot").addEventListener("click", () => toggleAuthView("forgot"));

  forms.login.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(forms.login);
    const userId = String(data.get("userId")).trim();
    const password = String(data.get("password")).trim();

    const user = state.users.find((candidate) => candidate.userId === userId);
    if (!user || user.password !== password) {
      toast("Invalid credentials. Retry or use Forgot.");
      toggleAuthView("forgot");
      return;
    }

    state.session = { userId: user.userId };
    persist();
    closeModal();
    state.activeView = state.authIntent;
    state.authIntent = "dashboard";
    toast(`Welcome back, ${user.name}`);
    render();
  });

  forms.register.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(forms.register);
    const userId = String(data.get("userId")).trim();

    if (state.users.some((candidate) => candidate.userId === userId)) {
      toast("User ID already exists");
      return;
    }

    const selectedSkills = [...document.querySelectorAll("#registerSkillTags .tag-pill.selected")].map(
      (pill) => pill.dataset.skill
    );

    const newUser = {
      userId,
      password: String(data.get("password")),
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      bio: String(data.get("bio")).trim(),
      skills: selectedSkills,
      reputation: 10,
      joinedAt: new Date().toISOString()
    };

    state.users.push(newUser);
    state.session = { userId };
    persist();
    closeModal();
    forms.register.reset();
    state.activeView = "profile";
    toast("Registration successful. Reputation initialized to 10.");
    render();
  });

  forms.forgot.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(forms.forgot);
    const userId = String(data.get("userId")).trim();
    const nextPassword = String(data.get("newPassword")).trim();
    const user = state.users.find((candidate) => candidate.userId === userId);

    if (!user) {
      toast("User not found");
      return;
    }

    user.password = nextPassword;
    persist();
    forms.forgot.reset();
    toggleAuthView("login");
    toast("Password reset successful. Please login.");
  });
}

function renderRegisterSkillTags() {
  const wrap = document.getElementById("registerSkillTags");
  wrap.innerHTML = SKILLS.map(
    (skill) => `<button class="tag-pill" type="button" data-skill="${skill}">${skill}</button>`
  ).join("");
  wrap.querySelectorAll(".tag-pill").forEach((pill) => {
    pill.addEventListener("click", () => pill.classList.toggle("selected"));
  });
}

function toggleAuthView(view) {
  const map = { login: forms.login, register: forms.register, forgot: forms.forgot };
  Object.values(map).forEach((form) => form.classList.add("hidden"));
  map[view].classList.remove("hidden");

  document.querySelectorAll(".btn-tab").forEach((btn) => btn.classList.remove("active"));
  const target = document.getElementById(`show${view[0].toUpperCase()}${view.slice(1)}`);
  if (target) target.classList.add("active");
}

function openAuthModal(view) {
  authModal.classList.remove("hidden");
  toggleAuthView(view);
}

function closeModal() {
  authModal.classList.add("hidden");
}

function currentUser() {
  if (!state.session) return null;
  return state.users.find((user) => user.userId === state.session.userId) || null;
}

function logout() {
  state.session = null;
  persist();
  state.activeView = "dashboard";
  render();
  toast("Logged out");
}

function ensureAuth(nextView) {
  const user = currentUser();
  if (user) return true;
  state.authIntent = nextView;
  openAuthModal("login");
  toast("Please login to continue");
  return false;
}

function render() {
  renderNav();
  renderHeaderActions();
  const user = currentUser();

  if (state.activeView === "dashboard") {
    app.innerHTML = renderDashboard(user);
    return;
  }

  if (state.activeView === "myTasks") {
    if (!ensureAuth("myTasks")) {
      state.activeView = "dashboard";
      app.innerHTML = renderDashboard(null);
      return;
    }
    app.innerHTML = renderMyTasks(user);
    attachMyTaskHandlers(user);
    return;
  }

  if (state.activeView === "browseTasks") {
    app.innerHTML = renderBrowseTasks(user);
    attachBrowseHandlers(user);
    return;
  }

  if (state.activeView === "news") {
    app.innerHTML = renderNews();
    attachNewsHandlers();
    return;
  }

  if (state.activeView === "profile") {
    if (!ensureAuth("profile")) {
      state.activeView = "dashboard";
      app.innerHTML = renderDashboard(null);
      return;
    }
    app.innerHTML = renderProfile(user);
    attachProfileHandlers(user);
  }
}

function renderNav() {
  const tabs = [
    ["dashboard", "Dashboard"],
    ["myTasks", "My Tasks"],
    ["browseTasks", "Browse Tasks"],
    ["news", "Tech News"],
    ["profile", "Profile"]
  ];

  nav.innerHTML = tabs
    .map(([key, label]) => {
      const activeClass = key === state.activeView ? "active" : "";
      return `<button class="nav-btn ${activeClass}" data-view="${key}">${label}</button>`;
    })
    .join("");

  nav.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeView = btn.dataset.view;
      render();
    });
  });
}

function renderHeaderActions() {
  authBtn.textContent = state.session ? "Logout" : "Login / Register";
}

function renderDashboard(user) {
  const userGreeting = user
    ? `<p>Signed in as <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.userId)})</p>`
    : `<p class="warning">You are browsing as a guest. Login for personalized workflows.</p>`;

  const openTasks = state.tasks.filter((task) => task.status === "Open").length;

  return `
    <section class="hero">
      <article class="card">
        <h2>Campus Collaboration, Upgraded</h2>
        <p>
          Sprint 1 now includes full creator and solver lanes: analytics-first profiles,
          status-driven task operations, proposal pipelines, and category-led tech news.
        </p>
        ${userGreeting}
      </article>
      <aside class="card">
        <h3>Sprint 1 Coverage</h3>
        <div class="kpi-grid">
          <div class="kpi"><div>Modules</div><strong>8</strong></div>
          <div class="kpi"><div>Total Tasks</div><strong>${state.tasks.length}</strong></div>
          <div class="kpi"><div>Open Tasks</div><strong>${openTasks}</strong></div>
        </div>
      </aside>
    </section>

    <section class="split">
      <article class="card">
        <h3>Creator Side</h3>
        <ul>
          <li>Tasks categorized into Open, Negotiation, Progress, Completed, and Disputed.</li>
          <li>Create tasks with title, description, tech stack, difficulty, budget, and deadline.</li>
          <li>Edit and delete actions enabled only for Open tasks.</li>
          <li>Application inbox visible for every created task.</li>
        </ul>
      </article>
      <article class="card">
        <h3>Solver Side</h3>
        <ul>
          <li>Browse only Open tasks with skill, difficulty, and budget filters.</li>
          <li>View full task details before applying.</li>
          <li>Submit proposals with notes and expected budget.</li>
          <li>Track tech trends and trending discussions by category.</li>
        </ul>
      </article>
    </section>
  `;
}

function renderMyTasks(user) {
  const ownTasks = state.tasks.filter((task) => task.owner === user.userId);
  const grouped = TASK_STATUSES.map((status) => ({
    status,
    tasks: ownTasks.filter((task) => task.status === status)
  }));

  const editingTask = state.editingTaskId
    ? ownTasks.find((task) => task.id === state.editingTaskId)
    : null;
  const isEditing = state.taskFormMode === "edit" && !!editingTask;

  return `
    <section class="split">
      <article class="card">
        <h2>My Tasks (Creator Side)</h2>
        <p>Manage your complete lifecycle from creation to closure.</p>
        <div class="list">
          ${grouped
            .map(
              (group) => `
              <section class="status-group">
                <h3>${group.status} <span class="status-count">(${group.tasks.length})</span></h3>
                ${
                  group.tasks.length
                    ? group.tasks.map((task) => renderCreatorTaskCard(task)).join("")
                    : `<p class="meta">No tasks in this category.</p>`
                }
              </section>
            `
            )
            .join("")}
        </div>
      </article>

      <article class="card">
        <h3>${isEditing ? "Edit Open Task" : "Create New Task"}</h3>
        <form id="createTaskForm">
          <input type="hidden" name="taskId" value="${editingTask ? editingTask.id : ""}" />
          <label>Title<input name="title" value="${editingTask ? escapeHtml(editingTask.title) : ""}" required /></label>
          <label>Description<textarea name="description" rows="3" required>${
            editingTask ? escapeHtml(editingTask.description) : ""
          }</textarea></label>
          <label>Tech Stack<input name="techStack" placeholder="React, Node.js, MongoDB" value="${
            editingTask ? escapeHtml(editingTask.techStack) : ""
          }" required /></label>
          <label>Difficulty
            <select name="difficulty" required>
              ${["Low", "Medium", "High"]
                .map((level) => `<option ${editingTask && editingTask.difficulty === level ? "selected" : ""}>${level}</option>`)
                .join("")}
            </select>
          </label>
          <label>Budget (INR)
            <input name="budget" type="number" min="0" step="500" value="${editingTask ? editingTask.budget : ""}" required />
          </label>
          <label>Deadline
            <input name="deadline" type="date" value="${editingTask ? editingTask.deadline : ""}" required />
          </label>
          <fieldset>
            <legend>Skill Tags</legend>
            <div id="taskTagPicker" class="tag-grid"></div>
          </fieldset>
          <button class="btn btn-secondary" type="submit">${isEditing ? "Save Task" : "Publish Task"}</button>
          ${isEditing ? '<button id="cancelTaskEdit" class="btn" type="button">Cancel Edit</button>' : ""}
        </form>
      </article>
    </section>
  `;
}

function renderCreatorTaskCard(task) {
  return `
    <div class="item">
      <h3>${escapeHtml(task.title)} <span class="status-badge status-${slug(task.status)}">${task.status}</span></h3>
      <p>${escapeHtml(task.description)}</p>
      <p class="meta">Tech: ${escapeHtml(task.techStack)} | Difficulty: ${task.difficulty}</p>
      <p class="meta">Budget: Rs ${Number(task.budget).toLocaleString()} | Deadline: ${task.deadline || "-"}</p>
      <div class="pill-row">${task.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}</div>

      <div class="action-row" style="margin-top:.55rem;">
        <label class="meta">Move Status</label>
        <select class="status-select" data-task-status="${task.id}">
          ${TASK_STATUSES.map((status) => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        ${
          task.status === "Open"
            ? `<button class="btn" data-edit-task="${task.id}" type="button">Edit</button>
               <button class="btn" data-delete-task="${task.id}" type="button">Delete</button>`
            : ""
        }
      </div>

      <div class="applications-wrap">
        <h4>Applications Received (${task.applications.length})</h4>
        ${
          task.applications.length
            ? `<div class="list">${task.applications
                .map(
                  (appItem) => `<div class="item app-item">
                    <p><strong>${escapeHtml(appItem.applicant)}</strong> proposed Rs ${Number(appItem.proposedBudget).toLocaleString()}</p>
                    <p>${escapeHtml(appItem.proposal)}</p>
                  </div>`
                )
                .join("")}</div>`
            : `<p class="meta">No applications yet.</p>`
        }
      </div>
    </div>
  `;
}

function attachMyTaskHandlers(user) {
  const ownTasks = state.tasks.filter((task) => task.owner === user.userId);
  const editingTask = state.editingTaskId ? ownTasks.find((task) => task.id === state.editingTaskId) : null;

  const picker = document.getElementById("taskTagPicker");
  if (picker) {
    picker.innerHTML = SKILLS.map((skill) => {
      const selected = editingTask && editingTask.tags.includes(skill) ? "selected" : "";
      return `<button type="button" class="tag-pill ${selected}" data-skill="${skill}">${skill}</button>`;
    }).join("");

    picker.querySelectorAll(".tag-pill").forEach((pill) => {
      pill.addEventListener("click", () => pill.classList.toggle("selected"));
    });
  }

  const form = document.getElementById("createTaskForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const taskId = String(data.get("taskId") || "").trim();
    const tags = [...picker.querySelectorAll(".selected")].map((pill) => pill.dataset.skill);
    const payload = {
      title: String(data.get("title")).trim(),
      description: String(data.get("description")).trim(),
      techStack: String(data.get("techStack")).trim(),
      difficulty: String(data.get("difficulty")),
      budget: Number(data.get("budget")) || 0,
      deadline: String(data.get("deadline")),
      tags
    };

    if (taskId) {
      const task = state.tasks.find((item) => item.id === taskId && item.owner === user.userId);
      if (!task || task.status !== "Open") {
        toast("Only Open tasks can be edited");
        return;
      }
      Object.assign(task, payload);
      state.taskFormMode = "create";
      state.editingTaskId = null;
      persist();
      toast("Task updated successfully");
      render();
      return;
    }

    state.tasks.unshift({
      id: crypto.randomUUID(),
      ...payload,
      owner: user.userId,
      status: "Open",
      applications: [],
      rating: null
    });
    persist();
    toast("Task published");
    render();
  });

  const cancelBtn = document.getElementById("cancelTaskEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.taskFormMode = "create";
      state.editingTaskId = null;
      render();
    });
  }

  app.querySelectorAll("[data-edit-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.editTask;
      const task = state.tasks.find((item) => item.id === taskId && item.owner === user.userId);
      if (!task || task.status !== "Open") {
        toast("Only Open tasks can be edited");
        return;
      }
      state.taskFormMode = "edit";
      state.editingTaskId = taskId;
      render();
    });
  });

  app.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.deleteTask;
      const task = state.tasks.find((item) => item.id === taskId && item.owner === user.userId);
      if (!task || task.status !== "Open") {
        toast("Only Open tasks can be deleted");
        return;
      }
      state.tasks = state.tasks.filter((item) => item.id !== taskId);
      persist();
      toast("Open task deleted");
      render();
    });
  });

  app.querySelectorAll("[data-task-status]").forEach((select) => {
    select.addEventListener("change", () => {
      const task = state.tasks.find((item) => item.id === select.dataset.taskStatus && item.owner === user.userId);
      if (!task) return;
      task.status = select.value;
      if (task.status === "Completed" && task.rating === null) {
        task.rating = 4.2;
      }
      persist();
      toast(`Task moved to ${task.status}`);
      render();
    });
  });
}

function renderBrowseTasks(user) {
  const openTasks = state.tasks.filter((task) => task.status === "Open");
  const filtered = openTasks.filter((task) => {
    const tagPass = state.browse.tag === "All" || task.tags.includes(state.browse.tag);
    const diffPass = state.browse.difficulty === "All" || task.difficulty === state.browse.difficulty;
    const budgetPass = budgetBucket(task.budget) === state.browse.budget || state.browse.budget === "All";
    return tagPass && diffPass && budgetPass;
  });

  const selected = filtered.find((task) => task.id === state.browse.selectedTaskId) || filtered[0] || null;

  return `
    <section class="split">
      <article class="card">
        <h2>Browse Tasks (Solver Side)</h2>
        <p>Find open opportunities, inspect details, and apply with proposals.</p>

        <div class="filter-grid">
          <label>Skill Tag
            <select id="filterTag">
              ${["All", ...SKILLS]
                .map((tag) => `<option ${state.browse.tag === tag ? "selected" : ""}>${tag}</option>`)
                .join("")}
            </select>
          </label>
          <label>Difficulty
            <select id="filterDifficulty">
              ${["All", "Low", "Medium", "High"]
                .map((level) => `<option ${state.browse.difficulty === level ? "selected" : ""}>${level}</option>`)
                .join("")}
            </select>
          </label>
          <label>Budget
            <select id="filterBudget">
              ${["All", "<10k", "10k-20k", "20k+"]
                .map((range) => `<option ${state.browse.budget === range ? "selected" : ""}>${range}</option>`)
                .join("")}
            </select>
          </label>
        </div>

        <div class="list">
          ${
            filtered.length
              ? filtered
                  .map(
                    (task) => `<button class="item task-select ${selected && selected.id === task.id ? "task-active" : ""}" data-select-task="${
                      task.id
                    }" type="button">
                      <h3>${escapeHtml(task.title)}</h3>
                      <p class="meta">${task.difficulty} | Rs ${Number(task.budget).toLocaleString()} | ${escapeHtml(task.owner)}</p>
                    </button>`
                  )
                  .join("")
              : `<p class="meta">No open tasks for current filters.</p>`
          }
        </div>
      </article>

      <article class="card">
        <h3>Task Details</h3>
        ${selected ? renderSolverTaskDetails(selected, user) : `<p class="meta">Select a task to view full details.</p>`}
      </article>
    </section>
  `;
}

function renderSolverTaskDetails(task, user) {
  const canApply = !!user && user.userId !== task.owner;
  const appliedAlready =
    !!user && task.applications.some((application) => application.applicant === user.userId);

  return `
    <div class="item detail-panel">
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.description)}</p>
      <p class="meta">Tech Stack: ${escapeHtml(task.techStack)}</p>
      <p class="meta">Difficulty: ${task.difficulty} | Budget: Rs ${Number(task.budget).toLocaleString()} | Deadline: ${task.deadline}</p>
      <div class="pill-row">${task.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}</div>

      ${
        !user
          ? `<p class="warning">Login to apply with a proposal.</p>`
          : !canApply
            ? `<p class="meta">You own this task.</p>`
            : appliedAlready
              ? `<p class="meta">You already submitted a proposal for this task.</p>`
              : `<form id="proposalForm" class="proposal-form">
                  <input type="hidden" name="taskId" value="${task.id}" />
                  <label>Proposal<textarea name="proposal" rows="3" required placeholder="Share your solution approach"></textarea></label>
                  <label>Expected Budget (INR)<input name="proposedBudget" type="number" min="0" step="500" required /></label>
                  <button class="btn btn-primary" type="submit">Submit Proposal</button>
                </form>`
      }
    </div>
  `;
}

function attachBrowseHandlers(user) {
  const filterTag = document.getElementById("filterTag");
  const filterDifficulty = document.getElementById("filterDifficulty");
  const filterBudget = document.getElementById("filterBudget");

  [
    [filterTag, "tag"],
    [filterDifficulty, "difficulty"],
    [filterBudget, "budget"]
  ].forEach(([element, key]) => {
    if (!element) return;
    element.addEventListener("change", () => {
      state.browse[key] = element.value;
      state.browse.selectedTaskId = null;
      render();
    });
  });

  app.querySelectorAll("[data-select-task]").forEach((button) => {
    button.addEventListener("click", () => {
      state.browse.selectedTaskId = button.dataset.selectTask;
      render();
    });
  });

  const proposalForm = document.getElementById("proposalForm");
  if (!proposalForm) return;

  proposalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!user) {
      state.authIntent = "browseTasks";
      openAuthModal("login");
      return;
    }

    const data = new FormData(proposalForm);
    const taskId = String(data.get("taskId"));
    const proposal = String(data.get("proposal")).trim();
    const proposedBudget = Number(data.get("proposedBudget")) || 0;
    const task = state.tasks.find((item) => item.id === taskId && item.status === "Open");

    if (!task) {
      toast("Task unavailable");
      render();
      return;
    }

    if (task.owner === user.userId) {
      toast("You cannot apply to your own task");
      return;
    }

    const alreadyApplied = task.applications.some((application) => application.applicant === user.userId);
    if (alreadyApplied) {
      toast("Proposal already submitted");
      return;
    }

    task.applications.push({
      id: crypto.randomUUID(),
      applicant: user.userId,
      proposal,
      proposedBudget,
      createdAt: new Date().toISOString()
    });
    task.status = "In Negotiation";
    persist();
    toast("Proposal submitted");
    render();
  });
}

function renderNews() {
  const categories = ["All", ...new Set(DEFAULT_NEWS.map((item) => item.category))];
  const feed =
    state.newsCategory === "All"
      ? DEFAULT_NEWS
      : DEFAULT_NEWS.filter((item) => item.category === state.newsCategory);

  return `
    <section class="split">
      <article class="card">
        <h2>Tech News</h2>
        <p>Latest technology posts categorized by domain.</p>
        <div id="newsCategories" class="pill-row">
          ${categories
            .map(
              (category) =>
                `<button class="tag-pill ${state.newsCategory === category ? "selected" : ""}" data-news-category="${category}">${category}</button>`
            )
            .join("")}
        </div>
        <div class="list" style="margin-top:.75rem;">
          ${feed
            .map(
              (news) => `<div class="item">
                <h3>${escapeHtml(news.title)}</h3>
                <p>${escapeHtml(news.summary)}</p>
                <p class="meta">${escapeHtml(news.source)} | Domain: ${news.category}</p>
              </div>`
            )
            .join("")}
        </div>
      </article>

      <article class="card">
        <h3>Trending Discussions</h3>
        <div class="list">
          ${TRENDING_DISCUSSIONS.map(
            (discussion) => `<div class="item">
              <h3>${escapeHtml(discussion.topic)}</h3>
              <p class="meta">Replies: ${discussion.replies}</p>
            </div>`
          ).join("")}
        </div>
      </article>
    </section>
  `;
}

function attachNewsHandlers() {
  app.querySelectorAll("[data-news-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.newsCategory = button.dataset.newsCategory;
      render();
    });
  });
}

function renderProfile(user) {
  const analytics = buildUserAnalytics(user);

  return `
    <section class="split">
      <article class="card">
        <h2>Profile Management</h2>
        <p>Manage your personal profile and skill identity.</p>
        <form id="profileForm">
          <label>Name<input name="name" value="${escapeHtml(user.name)}" required /></label>
          <label>Email<input name="email" value="${escapeHtml(user.email)}" type="email" required /></label>
          <label>Bio<textarea name="bio" rows="3">${escapeHtml(user.bio || "")}</textarea></label>
          <fieldset>
            <legend>Skills</legend>
            <div id="profileSkillTags" class="tag-grid"></div>
          </fieldset>
          <button class="btn btn-primary" type="submit">Save Profile</button>
          ${
            state.profileSavedAt
              ? `<p class="save-confirm">Saved at ${new Date(state.profileSavedAt).toLocaleTimeString()}</p>`
              : ""
          }
        </form>
      </article>

      <article class="card">
        <h3>Identity + Analytics</h3>
        <p><strong>User ID:</strong> ${escapeHtml(user.userId)}</p>
        <p><strong>Reputation:</strong> ${user.reputation}</p>
        <p><strong>Joined:</strong> ${new Date(user.joinedAt).toLocaleDateString()}</p>

        <div class="kpi-grid">
          <div class="kpi"><div>Tasks Completed</div><strong>${analytics.totalCompleted}</strong></div>
          <div class="kpi"><div>Avg Rating</div><strong>${analytics.avgRating}</strong></div>
          <div class="kpi"><div>Dispute Rate</div><strong>${analytics.disputeRate}%</strong></div>
        </div>

        <h3>Skill-wise Performance</h3>
        <div class="list">
          ${
            analytics.skillPerformance.length
              ? analytics.skillPerformance
                  .map(
                    (skill) => `<div class="item">
                    <p><strong>${escapeHtml(skill.skill)}</strong> - ${skill.completed}/${skill.total} completed</p>
                    <div class="meter"><span style="width:${skill.score}%"></span></div>
                  </div>`
                  )
                  .join("")
              : `<p class="meta">No task history yet for analytics.</p>`
          }
        </div>
      </article>
    </section>
  `;
}

function buildUserAnalytics(user) {
  const ownTasks = state.tasks.filter((task) => task.owner === user.userId);
  const completed = ownTasks.filter((task) => task.status === "Completed");
  const disputed = ownTasks.filter((task) => task.status === "Disputed");
  const avgRatingValue =
    completed.length > 0
      ? completed.reduce((sum, task) => sum + (typeof task.rating === "number" ? task.rating : 0), 0) /
        completed.length
      : 0;

  const bySkill = new Map();
  ownTasks.forEach((task) => {
    task.tags.forEach((skill) => {
      const entry = bySkill.get(skill) || { skill, total: 0, completed: 0 };
      entry.total += 1;
      if (task.status === "Completed") entry.completed += 1;
      bySkill.set(skill, entry);
    });
  });

  const skillPerformance = [...bySkill.values()]
    .map((entry) => ({
      ...entry,
      score: Math.round((entry.completed / entry.total) * 100)
    }))
    .sort((a, b) => b.score - a.score);

  return {
    totalCompleted: completed.length,
    avgRating: avgRatingValue.toFixed(1),
    disputeRate: ownTasks.length ? ((disputed.length / ownTasks.length) * 100).toFixed(1) : "0.0",
    skillPerformance
  };
}

function attachProfileHandlers(user) {
  const wrap = document.getElementById("profileSkillTags");
  wrap.innerHTML = SKILLS.map(
    (skill) =>
      `<button class="tag-pill ${user.skills.includes(skill) ? "selected" : ""}" type="button" data-skill="${skill}">${skill}</button>`
  ).join("");

  wrap.querySelectorAll(".tag-pill").forEach((pill) => {
    pill.addEventListener("click", () => pill.classList.toggle("selected"));
  });

  const form = document.getElementById("profileForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    user.name = String(data.get("name")).trim();
    user.email = String(data.get("email")).trim();
    user.bio = String(data.get("bio")).trim();
    user.skills = [...wrap.querySelectorAll(".selected")].map((pill) => pill.dataset.skill);
    state.profileSavedAt = Date.now();
    persist();
    toast("Profile updates saved and confirmed");
    render();
  });
}

function budgetBucket(budget) {
  if (budget < 10000) return "<10k";
  if (budget <= 20000) return "10k-20k";
  return "20k+";
}

function slug(value) {
  return String(value).toLowerCase().replaceAll(" ", "-");
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
