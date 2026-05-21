import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";

const HomePage = lazy(() => import("./pages/HomePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const TaskDetailsPage = lazy(() => import("./pages/TaskDetailsPage"));
const MyTasksPage = lazy(() => import("./pages/MyTasksPage"));
const ChatsPage = lazy(() => import("./pages/ChatsPage"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const SubmissionPage = lazy(() => import("./pages/SubmissionPage"));
const RatingsPage = lazy(() => import("./pages/RatingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AdminPanelPage = lazy(() => import("./pages/AdminPanelPage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const AdvancedSearchPage = lazy(() => import("./pages/AdvancedSearchPage"));
const TrendingTasksPage = lazy(() => import("./pages/TrendingTasksPage"));
const TechNewsPage = lazy(() => import("./pages/TechNewsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const DiscussionsPage = lazy(() => import("./pages/DiscussionsPage"));


export default function App() {
  return (
    <ThemeProvider><Layout>
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<Navigate to="/auth" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/task/:taskId" element={<TaskDetailsPage />} />
          <Route
            path="/my-tasks"
            element={
              <ProtectedRoute>
                <MyTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chats"
            element={
              <ProtectedRoute>
                <ChatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:taskId"
            element={
              <ProtectedRoute>
                <ChatRoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute>
                <AIChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task/:taskId/submit"
            element={
              <ProtectedRoute>
                <SubmissionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task/:taskId/rate"
            element={
              <ProtectedRoute>
                <RatingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/discussions" element={<DiscussionsPage />} />
          <Route path="/discussions/:postId" element={<DiscussionsPage />} />
          <Route path="/knowledge-base" element={<Navigate to="/tasks" replace />} />
          <Route path="/tech-news" element={<TechNewsPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/search" element={<AdvancedSearchPage />} />
          <Route path="/trending" element={<TrendingTasksPage />} />
          {/* Smart recommendations page removed to avoid broken endpoint */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
    </Layout></ThemeProvider>
  );
}
