import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Badge from "../components/Badge";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [preferences, setPreferences] = useState({
    task_updates: true,
    discussion_activity: true,
    recommendations: true,
    marketing: false,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState("");

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get("/notifications", {
        params: { unreadOnly: filter === "unread" ? "true" : "false" },
      });
      setNotifications(response.data.notifications || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await api.get("/notifications/preferences");
      setPreferences({
        task_updates: Boolean(response.data.preferences?.task_updates),
        discussion_activity: Boolean(response.data.preferences?.discussion_activity),
        recommendations: Boolean(response.data.preferences?.recommendations),
        marketing: Boolean(response.data.preferences?.marketing),
      });
    } catch (err) {
      console.error("Failed to load notification preferences:", err);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handlePreferenceChange = (field) => {
    setPreferences((prev) => ({ ...prev, [field]: !prev[field] }));
    setPreferenceMessage("");
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);
      setPreferenceMessage("");
      const response = await api.put("/notifications/preferences", preferences);
      setPreferences({
        task_updates: Boolean(response.data.preferences?.task_updates),
        discussion_activity: Boolean(response.data.preferences?.discussion_activity),
        recommendations: Boolean(response.data.preferences?.recommendations),
        marketing: Boolean(response.data.preferences?.marketing),
      });
      setPreferenceMessage("Notification preferences saved.");
    } catch (err) {
      setPreferenceMessage(err.response?.data?.message || "Unable to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleNavigateToTask = (taskId) => {
    if (taskId) {
      navigate(`/task/${taskId}`);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      PROPOSAL_ACCEPTED: "✓",
      PROPOSAL_REJECTED: "✗",
      PROPOSAL_RECEIVED: "💬",
      TASK_ASSIGNED: "🎯",
      SUBMISSION_RECEIVED: "📤",
      TASK_APPROVED: "✓",
      TASK_DISPUTED: "⚠️",
      DISPUTE_RESOLVED: "✓",
      MESSAGE_RECEIVED: "💬",
    };
    return icons[type] || "📢";
  };

  const getNotificationColor = (type) => {
    const colors = {
      PROPOSAL_ACCEPTED: "bg-green-50 border-green-200",
      PROPOSAL_REJECTED: "bg-red-50 border-red-200",
      PROPOSAL_RECEIVED: "bg-blue-50 border-blue-200",
      TASK_ASSIGNED: "bg-blue-50 border-blue-200",
      SUBMISSION_RECEIVED: "bg-purple-50 border-purple-200",
      TASK_APPROVED: "bg-green-50 border-green-200",
      TASK_DISPUTED: "bg-yellow-50 border-yellow-200",
      DISPUTE_RESOLVED: "bg-green-50 border-green-200",
      MESSAGE_RECEIVED: "bg-blue-50 border-blue-200",
    };
    return colors[type] || "bg-gray-50 border-gray-200";
  };

  return (
    <section className="space-y-6 fade-in max-w-3xl">
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">Notifications</h1>
            <p className="text-sm text-text/60 mt-1">Stay updated with your task activities</p>
          </div>
          {notifications.some((n) => !n.is_read) && (
            <Button variant="ghost" className="text-sm text-neon" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Filter Tabs */}
      <div className="card">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className={`px-4 py-2 rounded-lg text-sm transition ${
              filter === "all"
                ? "bg-neon/15 text-neon font-medium"
                : "bg-white/5 text-text/60 hover:bg-white/10"
            }`}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant="ghost"
            className={`px-4 py-2 rounded-lg text-sm transition ${
              filter === "unread"
                ? "bg-neon/15 text-neon font-medium"
                : "bg-white/5 text-text/60 hover:bg-white/10"
            }`}
            onClick={() => setFilter("unread")}
          >
            Unread
          </Button>
        </div>
      </div>

      

      {/* Notifications List */}
      {loading ? (
        <p className="text-sm text-text/60">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <div className="card text-center">
          <p className="text-sm text-text/60">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`card border ${getNotificationColor(notification.notification_type)} ${
                !notification.is_read ? "border-l-4" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-3 flex-1">
                  <span className="text-2xl">{getNotificationIcon(notification.notification_type)}</span>
                  <div className="flex-1">
                    <p className="font-medium text-text">{notification.message}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notification.is_read && (
                    <Button variant="ghost" className="text-xs text-neon" onClick={() => handleMarkAsRead(notification.id)}>
                      Mark read
                    </Button>
                  )}
                  <Button variant="ghost" className="text-xs text-danger" onClick={() => handleDeleteNotification(notification.id)}>
                    Delete
                  </Button>
                </div>
              </div>

              {notification.task_id && (
                <Button variant="ghost" className="text-xs text-neon mt-2" onClick={() => handleNavigateToTask(notification.task_id)}>
                  View Task →
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Notification Preferences</h2>
            <p className="text-sm text-text/60 mt-1">Choose what should trigger inbox updates.</p>
          </div>
          <Button onClick={handleSavePreferences} disabled={savingPreferences}>
            {savingPreferences ? "Saving..." : "Save Preferences"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PreferenceToggle
            label="Task updates"
            description="Proposal, assignment, approval, and dispute changes."
            checked={preferences.task_updates}
            onChange={() => handlePreferenceChange("task_updates")}
          />
          <PreferenceToggle
            label="Discussion activity"
            description="Replies and activity around community posts."
            checked={preferences.discussion_activity}
            onChange={() => handlePreferenceChange("discussion_activity")}
          />
          <PreferenceToggle
            label="Recommendations"
            description="Suggested tasks and posts based on your profile."
            checked={preferences.recommendations}
            onChange={() => handlePreferenceChange("recommendations")}
          />
          <PreferenceToggle
            label="Marketing"
            description="Product announcements and optional updates."
            checked={preferences.marketing}
            onChange={() => handlePreferenceChange("marketing")}
          />
        </div>

        {preferenceMessage && <p className="text-sm text-text/70">{preferenceMessage}</p>}
      </div>
    </section>
  );
}

function PreferenceToggle({ label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`rounded-2xl border p-4 text-left transition ${
        checked ? "border-neon/30 bg-neon/5" : "border-white/10 bg-surface/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-text">{label}</p>
          <p className="mt-1 text-xs text-text/60">{description}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${checked ? "bg-neon/15 text-neon" : "bg-white/5 text-text/60"}`}>
          {checked ? "On" : "Off"}
        </span>
      </div>
    </button>
  );
}
