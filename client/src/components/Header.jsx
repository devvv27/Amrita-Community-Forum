import { Link, NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { identifySocketUser, initSocket } from "../lib/socket";
import { Menu, X, Sun, Moon } from "lucide-react";
import { navItems } from "./navItems";
import { navClass } from "./navClass";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [privateUnread, setPrivateUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function fetchUnread() {
      if (!isAuthenticated) return setPrivateUnread(0);
      try {
        const res = await api.get('/messages/private/unread');
        const counts = res.data.counts || {};
        const total = Object.values(counts).reduce((s, v) => s + Number(v || 0), 0);
        if (mounted) setPrivateUnread(total);
      } catch (e) {
        console.error('Failed to fetch private unread counts', e);
      }
    }
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    const socket = initSocket();
    if (user?.id) {
      identifySocketUser(user.id);
      const handleUnreadUpdate = ({ totalUnread }) => {
        setPrivateUnread(Number(totalUnread || 0));
      };
      socket.on("private-unread-updated", handleUnreadUpdate);
      return () => {
        mounted = false;
        clearInterval(id);
        socket.off("private-unread-updated", handleUnreadUpdate);
      };
    }
    return () => { mounted = false; clearInterval(id); };
  }, [isAuthenticated]);

  return (
    <header className="bg-gradient-to-r from-obsidian via-surface to-obsidian text-text shadow-card border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="text-2xl font-bold text-neon">
          Amrita Forum
        </Link>
        {/* Desktop navigation */}
        <nav className="hidden lg:flex space-x-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <NavLink to="/my-tasks" className={navClass}>
              My Tasks
              {privateUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-white/6 px-2 py-0.5 text-xs font-semibold">{privateUnread}</span>
              )}
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/chats" className={navClass}>
              Chats
            </NavLink>
          )}
          {/* 'For You' recommendation link removed until backend is fixed */}
          {isAuthenticated && <NavLink to="/notifications" className={navClass}>Notifications</NavLink>}
          {isAuthenticated && <NavLink to="/profile" className={navClass}>Profile</NavLink>}
          {isAuthenticated && user?.isAdmin && <NavLink to="/admin" className={navClass}>Admin Panel</NavLink>}
          {!isAuthenticated ? (
            <>
              <NavLink to="/auth" className={navClass}>Login / Register</NavLink>
            </>
          ) : (
            <Button variant="danger" onClick={logout} className="px-3 py-2 rounded-md text-sm">
              Logout {user?.name ? `(${user.name})` : ""}
            </Button>
          )}
        </nav>
        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden text-text hover:text-neon"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
          {/* Dark mode toggle */}
          <button
            type="button"
            className="lg:hidden text-text hover:text-neon ml-2"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
      </div>
      {/* Mobile drawer */}
      {menuOpen && (
        <nav className="lg:hidden bg-obsidian/95 backdrop-blur-md border-t border-white/10">
          <div className="px-4 py-2 flex flex-col space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            {isAuthenticated && (
              <>
                <NavLink to="/my-tasks" className={navClass} onClick={() => setMenuOpen(false)}>
                  My Tasks
                </NavLink>
                <NavLink to="/chats" className={navClass} onClick={() => setMenuOpen(false)}>
                  Chats
                </NavLink>
                <NavLink to="/notifications" className={navClass} onClick={() => setMenuOpen(false)}>
                  Notifications
                </NavLink>
                <NavLink to="/profile" className={navClass} onClick={() => setMenuOpen(false)}>
                  Profile
                </NavLink>
                {user?.isAdmin && (
                  <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                    Admin Panel
                  </NavLink>
                )}
              </>
            )}
            {!isAuthenticated ? (
              <>
                <NavLink to="/auth" className={navClass} onClick={() => setMenuOpen(false)}>
                  Login / Register
                </NavLink>
              </>
            ) : (
              <Button variant="danger" onClick={logout}>
                Logout {user?.name ? `(${user.name})` : ""}
              </Button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
