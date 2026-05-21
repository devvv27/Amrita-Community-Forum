import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";
import { useState, useEffect, useRef, memo } from "react";
import { Menu } from "lucide-react";
import { navItems } from "./navItems";
import { navClass } from "./navClass";

function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const asideRef = useRef(null);

  // Focus first link when drawer opens
  useEffect(() => {
    if (navOpen && asideRef.current) {
      const first = asideRef.current.querySelector('a,button');
      if (first) first.focus();
    }
  }, [navOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && navOpen) {
        setNavOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navOpen]);

  return (
    <>
      {/* Hamburger button – visible on mobile only */}
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 rounded bg-white/10 p-2 text-ink hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/80"
        onClick={() => setNavOpen(!navOpen)}
        aria-label="Toggle navigation menu"
      >
        <Menu size={18} />
      </button>

      <aside
        role="navigation"
        ref={asideRef}
        className={`fixed left-0 top-0 z-30 flex h-screen w-72 flex-col border-r border-white/12 bg-[rgba(15,23,42,0.96)] px-4 py-5 backdrop-blur-xl transform transition-transform duration-300 ease-in-out ${navOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 pb-5">
          <div className="h-10 w-1 rounded-full bg-white/10" />
          <Link
            to="/"
            className="leading-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/80 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-muted">Community Forum</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-text">Amrita Community Forum</p>
          </Link>
        </div>

        <div className="pb-4 text-xs uppercase tracking-[0.26em] text-muted">
          A place to build, review, and ship work with intent
        </div>

        <nav className="flex flex-1 flex-col items-start gap-2 overflow-y-auto pr-1">
          {/* Static navigation items from config */}
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navClass}
              onClick={() => {
                try { localStorage.setItem('invertHeadingPath', item.to); } catch (e) {}
                setNavOpen(false);
              }}
            >
              {item.label}
            </NavLink>
          ))}

          {/* Auth‑dependent links */}
          {isAuthenticated && (
            <>
              <NavLink to="/my-tasks" className={navClass} onClick={() => { try { localStorage.setItem('invertHeadingPath', '/my-tasks'); } catch(e){} setNavOpen(false); }}>
                My Tasks
              </NavLink>
              <NavLink to="/chats" className={navClass} onClick={() => { try { localStorage.setItem('invertHeadingPath', '/chats'); } catch(e){} setNavOpen(false); }}>
                Chats
              </NavLink>
            </>
          )}
          {isAuthenticated && (
            <>
              <NavLink to="/notifications" className={navClass} onClick={() => { try { localStorage.setItem('invertHeadingPath', '/notifications'); } catch(e){} setNavOpen(false); }}>
                📢 Notifications
              </NavLink>
              <NavLink to="/profile" className={navClass} onClick={() => { try { localStorage.setItem('invertHeadingPath', '/profile'); } catch(e){} setNavOpen(false); }}>
                Profile
              </NavLink>
              {user?.isAdmin && (
                <NavLink to="/admin" className={navClass} onClick={() => { try { localStorage.setItem('invertHeadingPath', '/admin'); } catch(e){} setNavOpen(false); }}>
                  Admin Panel
                </NavLink>
              )}
            </>
          )}

          {/* Unauthenticated links */}
          {!isAuthenticated ? (
            <>
              <NavLink to="/auth" className={navClass} onClick={() => { try { localStorage.setItem('invertHeadingPath', '/auth'); } catch(e){} setNavOpen(false); }}>
                Login / Register
              </NavLink>
            </>
          ) : (
            <Button variant="danger" onClick={logout}>
              Logout {user?.name ? `(${user.name})` : ""}
            </Button>
          )}
        </nav>
      </aside>
    </>
  );
}

export default memo(NavBar);
