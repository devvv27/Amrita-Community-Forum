import { Link } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

export default function HomePage() {
  return (
    <section className="space-y-8 fade-in">
      <div className="hero-frame">
        <div className="hero-panel">
          <span className="section-label">Hacker Noir Interface</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.02] sm:text-5xl lg:text-6xl">
            A forum that reads like a studio briefing, not a template.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-text/75 sm:text-lg">
            Build tasks, debate ideas, solve problems, and track reputation in a system that feels deliberate,
            editorial, and engineered for serious work.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/tasks">
              <Button className="shadow-[0_0_24px_rgba(0,255,102,0.18)]">Explore Tasks</Button>
            </Link>
            <Link to="/discussions">
              <Button variant="secondary">Open Discussions</Button>
            </Link>
            <Link to="/profile">
              <Button variant="secondary">View Reputation</Button>
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Task Flow</p>
              <p className="mt-2 text-base font-semibold text-text">Creator to solver pipeline</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Discussion Core</p>
              <p className="mt-2 text-base font-semibold text-text">Upvote, resolve, and reply</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Reputation</p>
              <p className="mt-2 text-base font-semibold text-text">Measured, visible, persistent</p>
            </div>
          </div>
        </div>

        <aside className="support-panel flex flex-col justify-between gap-5">
          <div>
            <span className="signal-badge neon">Design Intent</span>
            <p className="mt-4 text-sm leading-6 text-text/70">
              The interface uses quiet hierarchy, hard edges, and selective glow so the product feels authored instead
              of assembled.
            </p>
          </div>

          <div className="stack-list text-sm">
            <div>
              <p className="eyebrow">Surface</p>
              <p className="mt-1 text-text">Obsidian panels with controlled depth</p>
            </div>
            <div>
              <p className="eyebrow">Accent</p>
              <p className="mt-1 text-text">Neon green for action, pink for warning</p>
            </div>
            <div>
              <p className="eyebrow">Typography</p>
              <p className="mt-1 text-text">Compact, high-contrast, and code-aware</p>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-white/10 bg-obsidian/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Working Principle</p>
            <p className="mt-2 text-sm leading-6 text-text/75">
              Every page should feel like it was designed by someone who cared about the problem, not by a default UI
              kit.
            </p>
          </div>
        </aside>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="transition hover:-translate-y-0.5 hover:border-neon/20">
          <h2 className="font-semibold text-lg">Task Marketplace</h2>
          <p className="text-sm text-text/75 mt-2">Creator and solver flows with status tracking and proposal management.</p>
        </Card>
        <Card className="transition hover:-translate-y-0.5 hover:border-neon/20">
          <h2 className="font-semibold text-lg">Discussion Engine</h2>
          <p className="text-sm text-text/75 mt-2">Post in categories, vote quality up/down, and build threaded conversation quality.</p>
        </Card>
        <Card className="transition hover:-translate-y-0.5 hover:border-neon/20">
          <h2 className="font-semibold text-lg">Profile Analytics</h2>
          <p className="text-sm text-text/75 mt-2">Track tasks created, completed, disputes, and proposal acceptance metrics.</p>
        </Card>
      </div>
    </section>
  );
}
