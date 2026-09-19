import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, BookOpen, HelpCircle, CalendarDays, BarChart3, Compass,
  FileText, MessagesSquare, Settings, Sun, Moon, LogOut, Menu, X, Flame,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export const NAV = [
  { to: "/", label: "Home", icon: Home, title: "Home", sub: "Your learning at a glance", end: true },
  { to: "/tutor", label: "AI Tutor", icon: BookOpen, title: "AI Tutor", sub: "Concepts explained at your level" },
  { to: "/quiz", label: "Quiz Generator", icon: HelpCircle, title: "Quiz Generator", sub: "Practice questions, graded instantly" },
  { to: "/planner", label: "Study Planner", icon: CalendarDays, title: "Study Planner", sub: "A plan built from how you actually perform" },
  { to: "/progress", label: "Progress", icon: BarChart3, title: "Progress Dashboard", sub: "What's improving and what isn't" },
];

export const NAV_MORE = [
  { to: "/career", label: "Career Guidance", icon: Compass, title: "Career Guidance", sub: "Roles matched to your measured strengths" },
  { to: "/assignments", label: "Assignments", icon: FileText, title: "Assignment Generator", sub: "Briefs, tasks and marking schemes" },
  { to: "/doubts", label: "Doubt Forum", icon: MessagesSquare, title: "Doubt Forum", sub: "Ask the community, get an AI answer instantly" },
  { to: "/settings", label: "Settings", icon: Settings, title: "Settings", sub: "Your learning profile and preferences" },
];

const ALL = [...NAV, ...NAV_MORE];

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-pill"
              className="pill"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <Icon size={16} />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function StreakCard({ streak }) {
  const tier =
    streak >= 30 ? "A month of consistency — outstanding." :
    streak >= 14 ? "Two weeks strong. This is becoming a habit." :
    streak >= 7 ? "A full week — keep the momentum going." :
    streak >= 3 ? "Building momentum — don't break it now." :
    streak >= 1 ? "Nice start. Come back tomorrow to grow it." :
    "Open a quiz or your tutor today to start one.";
  return (
    <div className="streak-card" title="Consecutive days you've been active in EduMind">
      <div className="streak-card-top">
        <span className="streak-flame"><Flame size={17} /></span>
        <div className="streak-num">
          <b>{streak}</b>
          <small>day streak</small>
        </div>
      </div>
      <p>{tier}</p>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  const page =
    ALL.find((n) => (n.end ? n.to === location.pathname : location.pathname.startsWith(n.to))) || NAV[0];

  const initials = (user?.name || "S")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app">
      <AnimatePresence>
        {open && (
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="mark">
            <BookOpen size={16} />
          </span>
          <span>
            EduMind <em>AI</em>
          </span>
        </div>

        <StreakCard streak={user?.streak || 0} />

        <nav className="nav-group">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        <div className="nav-label">More</div>
        <nav className="nav-group">
          {NAV_MORE.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        <div className="whoami">
          <span className="avatar">{initials}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name || "Student"}
            </b>
            <small>{user?.department || "Student"}</small>
          </span>
          <button
            className="icon-btn"
            style={{ width: 30, height: 30, background: "transparent", borderColor: "rgba(255,255,255,.14)", color: "#8a97bd" }}
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-only"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>

          <div style={{ minWidth: 0 }}>
            <h1>{page.title}</h1>
            <p>{page.sub}</p>
          </div>

          <div className="spacer" />

          <button
            className="icon-btn"
            onClick={toggle}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? "moon" : "sun"}
                initial={{ opacity: 0, rotate: -80, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 80, scale: 0.6 }}
                transition={{ duration: 0.22 }}
                style={{ display: "grid", placeItems: "center" }}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </header>

        <AnimatePresence mode="wait">
          <Outlet key={location.pathname} />
        </AnimatePresence>
      </div>
    </div>
  );
}
