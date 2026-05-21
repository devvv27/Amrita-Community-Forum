import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [skillsInput, setSkillsInput] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [people, setPeople] = useState([]);
  const [searchForm, setSearchForm] = useState({ q: "", skill: "", minReputation: "" });
  const [loading, setLoading] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    loadProfile();
    loadLeaderboard();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const response = await api.get("/profile/me");
      setProfile(response.data);
      setSkillsInput((response.data.user.skills || []).join(", "));
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    try {
      const response = await api.get("/analytics/leaderboard", { params: { limit: 5 } });
      setLeaderboard(response.data.leaderboard || []);
    } catch (apiError) {
      console.error("Unable to load leaderboard", apiError);
    }
  }

  async function handleUpdateSkills(event) {
    event.preventDefault();
    setError("");

    try {
      const nextSkills = skillsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await api.put("/profile/me/skills", { skills: nextSkills });
      setProfile((prev) => ({ ...prev, user: { ...prev.user, ...response.data.user } }));
      setSkillsInput((response.data.user.skills || []).join(", "));
      await loadProfile();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update skills");
    }
  }

  async function handleSearchPeople(event) {
    event.preventDefault();
    setSearchError("");
    setLoadingPeople(true);

    try {
      const params = {};
      if (searchForm.q.trim()) params.q = searchForm.q.trim();
      if (searchForm.skill.trim()) params.skill = searchForm.skill.trim();
      if (searchForm.minReputation) params.minReputation = searchForm.minReputation;

      const response = await api.get("/profile/search", { params });
      setPeople(response.data.people || []);
    } catch (apiError) {
      setSearchError(apiError.response?.data?.message || "Unable to search people");
    } finally {
      setLoadingPeople(false);
    }
  }

  const analytics = profile?.analytics || {};
  const skillBreakdown = profile?.skills || [];
  const badges = deriveBadges(profile?.user?.reputation ?? user?.reputation ?? 0, analytics);

  if (loading && !profile) {
    return <p className="text-text/70">Loading profile...</p>;
  }

  return (
    <section className="space-y-6 fade-in">
      {error && <p className="text-sm text-danger">{error}</p>}

      <Card className="relative overflow-hidden" accent>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Reputation Profile</p>
            <h1 className="mt-2 text-3xl font-bold">{profile?.user?.name || user?.name}</h1>
            <p className="text-sm text-text/70 mt-1">{profile?.user?.email || user?.email}</p>
          </div>

          <div className="rounded-2xl bg-surface text-text px-5 py-4 shadow-lg min-w-40 border border-white/10">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Reputation</p>
            <p className="mt-1 text-4xl font-black">{profile?.user?.reputation ?? 0}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(profile?.user?.skills || user?.skills || []).map((skill) => (
            <Badge key={skill} tone="neon" className="px-3 py-1 text-xs">
              {skill}
            </Badge>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Badge key={badge} className="px-3 py-1 text-xs">
              {badge}
            </Badge>
          ))}
        </div>

        <form onSubmit={handleUpdateSkills} className="mt-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-muted">Skill Tag Management</span>
            <input
              className="input"
              value={skillsInput}
              onChange={(event) => setSkillsInput(event.target.value)}
              placeholder="React, Node.js, PostgreSQL"
            />
          </label>
          <Button variant="secondary" className="h-11" type="submit">
            Save Skills
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tasks Completed" value={analytics.tasks_completed} tone="emerald" />
        <MetricCard label="Average Rating" value={Number(analytics.average_rating || 0).toFixed(2)} tone="amber" />
        <MetricCard label="Completion Rate" value={`${Number(analytics.completion_rate || 0).toFixed(2)}%`} tone="blue" />
        <MetricCard label="Dispute Rate" value={`${Number(analytics.dispute_rate || 0).toFixed(2)}%`} tone="rose" />
        <MetricCard label="Tasks Created" value={analytics.tasks_created} tone="slate" />
        <MetricCard label="Posts Created" value={analytics.posts_created} tone="slate" />
        <MetricCard label="Comments Contributed" value={analytics.comments_contributed} tone="slate" />
        <MetricCard label="Upvotes Received" value={analytics.upvotes_received} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Skill Breakdown</h2>
            <span className="text-xs uppercase tracking-wide text-muted">Performance by skill</span>
          </div>

          {skillBreakdown.length === 0 ? (
            <p className="text-sm text-text/60">No skill performance data yet.</p>
          ) : (
            <div className="space-y-3">
              {skillBreakdown.map((skill) => (
                <div key={skill.skill} className="rounded-2xl border border-white/10 bg-surface/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{skill.skill}</p>
                      <p className="text-xs text-text/60">{skill.tasks_completed} tasks completed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{Number(skill.average_rating || 0).toFixed(2)} / 5</p>
                      <p className="text-xs text-text/60">Rs {Number(skill.total_earnings || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card space-y-4">
          <h2 className="text-lg font-semibold">Community Activity</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Posts Created" value={analytics.posts_created} />
            <MiniStat label="Comments Contributed" value={analytics.comments_contributed} />
            <MiniStat label="Upvotes Received" value={analytics.upvotes_received} />
            <MiniStat label="Earnings" value={`Rs ${Number(analytics.total_earnings || 0).toFixed(2)}`} />
          </div>
          <p className="text-sm text-text/65">
            Reputation combines task completion, rating quality, dispute rate, posts, comments, and community feedback.
          </p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Community Leaderboard</h2>
            <span className="text-xs uppercase tracking-wide text-muted">Top by reputation</span>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-sm text-text/60">Leaderboard data is not available yet.</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, index) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface/80 p-4">
                  <div>
                    <p className="font-medium">#{index + 1} {entry.name}</p>
                    <p className="text-xs text-text/60">{entry.tasks_completed} tasks completed | {Number(entry.average_rating || 0).toFixed(2)} avg rating</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{entry.reputation}</p>
                    <p className="text-xs text-text/60">Rep</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">People Search</h2>
            <span className="text-xs uppercase tracking-wide text-muted">Find collaborators</span>
          </div>

          <form onSubmit={handleSearchPeople} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="input"
                placeholder="Name or email"
                value={searchForm.q}
                onChange={(event) => setSearchForm((prev) => ({ ...prev, q: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Skill"
                value={searchForm.skill}
                onChange={(event) => setSearchForm((prev) => ({ ...prev, skill: event.target.value }))}
              />
              <input
                className="input"
                type="number"
                min="0"
                placeholder="Min reputation"
                value={searchForm.minReputation}
                onChange={(event) => setSearchForm((prev) => ({ ...prev, minReputation: event.target.value }))}
              />
            </div>
            <Button type="submit">Search People</Button>
          </form>

          {searchError && <p className="text-sm text-danger">{searchError}</p>}

          {loadingPeople ? (
            <p className="text-sm text-text/60">Searching people...</p>
          ) : people.length === 0 ? (
            <p className="text-sm text-text/60">Run a search to see matching profiles.</p>
          ) : (
            <div className="space-y-3">
              {people.map((person) => (
                <div key={person.id} className="rounded-2xl border border-white/10 bg-surface/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className="text-xs text-text/60">{person.email}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{person.reputation} rep</p>
                      <p className="text-xs text-text/60">{person.tasks_completed} tasks completed</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(person.skills || []).map((skill) => (
                      <span key={skill} className="rounded-full bg-neon/10 px-3 py-1 text-xs text-neon">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function MetricCard({ label, value, tone }) {
  const toneClasses = {
    emerald: "from-neon/10 to-surface border-neon/20",
    amber: "from-danger/10 to-surface border-danger/20",
    blue: "from-neon/10 to-surface border-neon/20",
    rose: "from-danger/10 to-surface border-danger/20",
    slate: "from-white/5 to-surface border-white/10",
  };

  return (
    <article className={`card bg-gradient-to-br ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value ?? 0}</p>
    </article>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/80 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value ?? 0}</p>
    </div>
  );
}

function deriveBadges(reputation, analytics) {
  const badges = [];

  if (reputation >= 80) badges.push("Top Performer");
  if (Number(analytics.tasks_completed || 0) >= 10) badges.push("Task Finisher");
  if (Number(analytics.posts_created || 0) >= 5) badges.push("Community Builder");
  if (Number(analytics.comments_contributed || 0) >= 10) badges.push("Forum Voice");
  if (Number(analytics.upvotes_received || 0) >= 15) badges.push("Trusted Peer");

  if (badges.length === 0) {
    badges.push("Rising Contributor");
  }

  return badges;
}
