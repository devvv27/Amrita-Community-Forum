import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Input from "../components/Input";

const initialTaskForm = {
  title: "",
  description: "",
  techStack: "",
  difficulty: "INTERMEDIATE",
  budget: "",
  deadline: "",
};

export default function TasksPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [myProposals, setMyProposals] = useState([]);
  const [myCreatedTasks, setMyCreatedTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [savedTasks, setSavedTasks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialTaskForm);
  const [submitted, setSubmitted] = useState(false);
  const [filters, setFilters] = useState({ skill: "", difficulty: "", minBudget: "", maxBudget: "" });
  const [search, setSearch] = useState("");

  async function fetchTasks(nextFilters = filters, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const params = {};
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      if (nextSearch && nextSearch.trim()) params.q = nextSearch.trim();

      const res = await api.get("/tasks", { params });
      const list = res.data.tasks || [];
      list.sort((a, b) => {
        const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
        const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
        if (bDate !== aDate) return bDate - aDate;
        return (b.id || 0) - (a.id || 0);
      });
      setTasks(list);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function fetchMyCreated() {
      try {
        const res = await api.get('/tasks/mine/created');
        setMyCreatedTasks(res.data.tasks || []);
      } catch (e) {
        console.error('Unable to load created tasks', e);
      }
    }
    fetchMyCreated();
    // fetch saved tasks for sidebar
    async function fetchSaved() {
      try {
        const res = await api.get('/tasks/saved');
        setSavedTasks(res.data.tasks || []);
      } catch (e) {
        console.error('Unable to load saved tasks', e);
      }
    }
    fetchSaved();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyProposals([]);
      return;
    }
    async function fetchMyProposals() {
      try {
        const res = await api.get('/tasks/mine/proposals');
        setMyProposals(res.data.proposals || []);
      } catch (e) {
        console.error('Unable to load proposals', e);
      }
    }
    fetchMyProposals();
  }, [isAuthenticated]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchTasks(filters, search);
  }

  async function openTask(taskId) {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      setSelectedTask(res.data.task);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load task');
    }
  }

  async function toggleSavedTask(taskId) {
    try {
      await api.post(`/tasks/${taskId}/save`);
      await fetchTasks();
      if (isAuthenticated) {
        try {
          const res = await api.get('/tasks/saved');
          setSavedTasks(res.data.tasks || []);
        } catch (e) {
          console.error('Unable to refresh saved tasks', e);
        }
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to update saved tasks');
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setSubmitted(true);
    setError("");

    if (!form.title.trim() || !form.description.trim() || !form.budget || !form.deadline) {
      setError("Please complete the required task fields.");
      return;
    }

    try {
      await api.post("/tasks", {
        title: form.title,
        description: form.description,
        techStack: form.techStack
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        difficulty: form.difficulty,
        budget: Number(form.budget),
        deadline: form.deadline,
      });
      setForm(initialTaskForm);
      fetchTasks();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to create task');
    }
  }

  async function handleApply(taskId) {
    const message = window.prompt("Proposal message");
    const bid = window.prompt("Bid amount");
    if (!message || !bid) return;
    try {
      await api.post(`/tasks/${taskId}/proposals`, { message, bidAmount: Number(bid) });
      window.alert('Proposal submitted');
      const res = await api.get('/tasks/mine/proposals');
      setMyProposals(res.data.proposals || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to submit proposal');
    }
  }

  return (
    <section className="space-y-6 fade-in">
      <h1 className="text-2xl font-semibold">Task Board</h1>
      <p className="text-sm text-text/70 mt-1">Open opportunities from the community.</p>

      {isAuthenticated && (
        <form onSubmit={handleCreateTask} className="card space-y-3 mt-4">
          <h2 className="text-lg font-semibold">Create Task</h2>
          <Input
            label="Task title"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            error={submitted && !form.title.trim() ? 'Title is required' : ''}
            required
          />
          <Input
            as="textarea"
            label="Description"
            inputClassName="min-h-24"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            error={submitted && !form.description.trim() ? 'Description is required' : ''}
            required
          />
          <Input
            label="Tech stack"
            placeholder="Tech Stack (comma separated)"
            value={form.techStack}
            onChange={(e) => setForm((p) => ({ ...p, techStack: e.target.value }))}
            hint="Optional. Separate technologies with commas."
          />

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text">Difficulty</span>
              <select className="input" value={form.difficulty} onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))}>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            <Input label="Budget" type="number" min="0" placeholder="Budget" value={form.budget} onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))} error={submitted && !form.budget ? 'Budget is required' : ''} required />
            <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} error={submitted && !form.deadline ? 'Deadline is required' : ''} required />
            {/* Team removed */}
          </div>

          <Button variant="primary" type="submit">Publish Task</Button>
        </form>
      )}

      {isAuthenticated && (
        <article className="card">
          <h2 className="text-lg font-semibold">My Tasks</h2>
          <p className="text-sm text-text/70 mt-1">Tasks you created (top) and tasks you applied for (below).</p>

          <div className="mt-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Created Tasks</h3>
              {myCreatedTasks.length === 0 ? (
                <p className="text-sm text-text/60 mt-2">You haven't created any tasks yet.</p>
              ) : (
                myCreatedTasks.map((t) => (
                  <div key={t.id} className="rounded-xl border border-white/10 p-3 bg-surface/80 mt-2">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-text/60">Status: {t.status} | Budget: Rs {t.budget}</p>
                    <div className="mt-2">
                      <Button variant="secondary" onClick={() => navigate(`/task/${t.id}`)}>Manage</Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Applied Tasks</h3>
              {myProposals.length === 0 ? (
                <p className="text-sm text-text/60 mt-2">You haven't applied to any tasks yet.</p>
              ) : (
                myProposals.map((p) => (
                  <div key={p.id} className="rounded-xl border border-white/10 p-3 bg-surface/80 mt-2">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-text/60">Status: {p.status} | Bid: Rs {p.bid_amount}</p>
                    <div className="mt-2">
                      <Button variant="secondary" onClick={() => navigate(`/task/${p.task_id}`)}>Open Task</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      )}

      <Card>
        <form onSubmit={handleSearchSubmit} className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-5">
            <Input className="sm:col-span-2" label="Search tasks" placeholder="Search title, description, or tech stack" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Input label="Skill" placeholder="Skill" value={filters.skill} onChange={(e) => setFilters((p) => ({ ...p, skill: e.target.value }))} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text">Difficulty</span>
              <select className="input" value={filters.difficulty} onChange={(e) => setFilters((p) => ({ ...p, difficulty: e.target.value }))}>
                <option value="">Any Difficulty</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            <Input label="Min budget" type="number" min="0" placeholder="Min Budget" value={filters.minBudget} onChange={(e) => setFilters((p) => ({ ...p, minBudget: e.target.value }))} />
            <Input label="Max budget" type="number" min="0" placeholder="Max Budget" value={filters.maxBudget} onChange={(e) => setFilters((p) => ({ ...p, maxBudget: e.target.value }))} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="secondary">Search</Button>
            <Button type="button" variant="secondary" onClick={() => { const cleared = { skill: "", difficulty: "", minBudget: "", maxBudget: "" }; setSearch(""); setFilters(cleared); fetchTasks(cleared, ""); }}>Reset</Button>
          </div>
        </form>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {loading ? (
            <p className="text-text/70">Loading tasks...</p>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                  </div>
                  <Badge className="text-xs" tone="neon">{task.status}</Badge>
                </div>

                <p className="text-sm text-text/80 mt-2">{task.description}</p>
                <p className="text-xs text-text/60 mt-3">Creator: {task.creator_name} | Difficulty: {task.difficulty} | Budget: Rs {task.budget}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(task.tech_stack || []).map((skill) => (
                    <Badge key={skill} className="text-xs" tone="neutral">{skill}</Badge>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openTask(task.id)}>View Detail</Button>
                  {isAuthenticated ? (
                    <>
                      <Button variant="primary" onClick={() => handleApply(task.id)}>Submit Proposal</Button>
                      <Button variant="secondary" onClick={() => toggleSavedTask(task.id)}>Save Task</Button>
                    </>
                  ) : (
                    <Link to="/auth"><Button variant="secondary">Login to Apply</Button></Link>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        <aside className="card h-fit space-y-4">
          <h2 className="text-lg font-semibold">Task Detail</h2>

          {!selectedTask ? (
            <p className="text-sm text-text/70">Select a task to view complete details.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-surface/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{selectedTask.title}</h3>
                  <span className="text-xs text-text/60">Status: {selectedTask.status}</span>
                </div>
                <p className="mt-2 text-sm text-text/80">{selectedTask.description}</p>
                <p className="text-xs text-text/60 mt-2">Creator: {selectedTask.creator_name}</p>
                <p className="text-xs text-text/60">Difficulty: {selectedTask.difficulty} | Budget: Rs {selectedTask.budget}</p>
                <p className="text-xs text-text/60">Deadline: {selectedTask.deadline}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedTask.tech_stack || []).map((s) => (
                    <Badge key={s} className="text-xs" tone="neutral">{s}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onClick={() => handleApply(selectedTask.id)}>Submit Proposal</Button>
                <Button variant="secondary" onClick={() => toggleSavedTask(selectedTask.id)}>Save Task</Button>
                <Button variant="secondary" onClick={() => navigate(`/task/${selectedTask.id}`)}>Manage</Button>
              </div>
            </div>
          )}

          {isAuthenticated && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Saved Tasks</h3>
              {savedTasks.length === 0 ? (
                <p className="text-sm text-text/60 mt-2">No saved tasks yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {savedTasks.map((s) => (
                    <button key={s.id} type="button" className="w-full rounded-xl border border-white/10 bg-surface/80 p-3 text-left hover:border-neon/30" onClick={() => openTask(s.id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{s.title}</p>
                          <p className="text-xs text-text/60 mt-1">By {s.creator_name}</p>
                        </div>
                        <span className="text-xs text-text/60">Rs {s.budget}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
