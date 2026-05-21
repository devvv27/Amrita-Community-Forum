import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatComponent from "../components/ChatComponent";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

export default function ChatRoomPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);

  useEffect(() => {
    if (!taskId) return navigate('/chats');

    async function load() {
      try {
        const res = await api.get(`/tasks/${taskId}/details`);
        setTask(res.data.task);
      } catch (e) {
        console.error('Unable to load task for chat', e);
      }
    }

    load();
  }, [taskId, navigate]);

  const otherName = task
    ? (user?.id === task.creator_id ? (task.solver_name || 'No assignee') : task.creator_name)
    : '';

  const headerText = `${truncate(otherName, 24)} — ${truncate(task?.title || '', 48)}`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" title={`${otherName} — ${task?.title || ''}`}>{headerText}</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => navigate(`/task/${taskId}`)}>View Task Details</button>
          <button className="btn" onClick={() => navigate('/chats')}>Back to Chats</button>
        </div>
      </div>

      <div className="">
        <ChatComponent taskId={Number(taskId)} userId={user?.id} userName={user?.name} standalone taskStatus={task?.status} />
      </div>
    </section>
  );
}
