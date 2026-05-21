import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChatComponent from "../components/ChatComponent";
import PrivateChat from "../components/PrivateChat";
import { api } from "../lib/api";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

export default function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [kbDrafting, setKBDrafting] = useState(false);

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  async function fetchTaskDetails() {
    try {
      setLoading(true);
      const response = await api.get(`/tasks/${taskId}/details`);
      setTask(response.data.task);
      setProposals(response.data.proposals || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load task");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptProposal(proposalId) {
    try {
      await api.patch(`/tasks/proposals/${proposalId}`, { status: "ACCEPTED" });
      setSelectedProposal(proposalId);
      await fetchTaskDetails();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to accept proposal");
    }
  }

  async function handleTakeUpTask() {
    const message = window.prompt("Proposal message");
    const bid = window.prompt("Bid amount");

    if (!message || !bid) {
      return;
    }

    try {
      await api.post(`/tasks/${taskId}/proposals`, {
        message,
        bidAmount: Number(bid),
      });
      setError("");
      await fetchTaskDetails();
      setShowChat(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit proposal");
    }
  }

  async function handleConfirmNegotiation(proposalId) {
    try {
      await api.post("/tasks/negotiate/confirm", { taskId, proposalId });
      setSelectedProposal(proposalId);
      setShowChat(true);
      await fetchTaskDetails();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to confirm negotiation");
    }
  }

  function handleSubmitDeliverables() {
    navigate(`/task/${taskId}/submit`);
  }

  async function handleApproveSubmission() {
    try {
      await api.patch(`/submissions/${taskId}/approve`);
      await fetchTaskDetails();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve submission");
    }
  }

  async function handleRejectSubmission() {
    const reason = window.prompt("Enter reason for rejection:");
    if (!reason) return;

    try {
      await api.patch(`/submissions/${taskId}/reject`, { reason });
      await fetchTaskDetails();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject submission");
    }
  }

  async function handleRaiseDispute() {
    const reason = window.prompt("Enter dispute reason:");
    if (!reason) return;

    try {
      await api.post(`/disputes/${taskId}/raise`, { reason });
      await fetchTaskDetails();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to raise dispute");
    }
  }

  function handleRateTask() {
    navigate(`/task/${taskId}/rate`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-text/60">Loading task details...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-danger">{error || "Task not found"}</p>
      </div>
    );
  }

  const isCreator = user?.id === task.creator_id;
  const isSolver = user?.id === task.assigned_solver_id;
  const isAuthenticatedUser = Boolean(user?.id);
  const isInNegotiation = task.status === "IN_NEGOTIATION";
  const isInProgress = task.status === "IN_PROGRESS";
  const isUnderReview = task.status === "UNDER_REVIEW";
  const hasProposalAccess = proposals.some((proposal) => proposal.solver_id === user?.id);
  const canOpenChat = isCreator || isSolver || hasProposalAccess;

  const taskActions = [];

  if (task.status === "OPEN" && isAuthenticatedUser && !isCreator) {
    taskActions.push(
      <Button key="take-up-task" onClick={handleTakeUpTask}>
        Take Up Task / Submit Proposal
      </Button>
    );
  }

  if (isCreator && isInNegotiation && selectedProposal) {
    taskActions.push(
      <Button key="confirm-negotiation" onClick={() => handleConfirmNegotiation(selectedProposal)}>
        Confirm Negotiation
      </Button>
    );
  }

  if (isSolver && isInProgress) {
    taskActions.push(
      <Button key="submit-deliverables" onClick={handleSubmitDeliverables}>
        Submit Deliverables
      </Button>
    );
  }

  if (isCreator && isUnderReview) {
    taskActions.push(
      <Button key="approve-submission" onClick={handleApproveSubmission}>
        Approve Submission
      </Button>,
      <Button key="reject-submission" variant="secondary" onClick={handleRejectSubmission}>
        Reject Submission
      </Button>
    );
  }

  if (task.status === "COMPLETED" && isSolver) {
    taskActions.push(
      <Button key="rate-task" onClick={handleRateTask}>
        Rate & Provide Feedback
      </Button>
    );
  }

  if ((isCreator || isSolver) && ["IN_PROGRESS", "UNDER_REVIEW", "COMPLETED"].includes(task.status)) {
    taskActions.push(
      <Button key="raise-dispute" variant="secondary" onClick={handleRaiseDispute}>
        Raise Dispute
      </Button>
    );
  }

  return (
    <section className="space-y-6 fade-in">
      {error && <p className="text-sm text-danger">{error}</p>}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{task.title}</h1>
            <p className="mt-1 text-sm text-text/60">Created by {task.creator_name}</p>
            {task.solver_name && <p className="text-sm text-text/60">Assigned to {task.solver_name}</p>}
          </div>
          <Badge tone="neon" className="px-3 py-1 text-sm font-medium">{task.status.replaceAll("_", " ")}</Badge>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Budget" value={`Rs ${task.budget}`} />
          <Metric label="Difficulty" value={task.difficulty} />
          <Metric label="Deadline" value={new Date(task.deadline).toDateString()} />
          <Metric label="Tech Stack" value={(task.tech_stack || []).join(", ") || "-"} />
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium">Description</p>
          <p className="mt-2 text-sm text-text/80">{task.description}</p>
        </div>
          {/* Private 1:1 chat with creator */}
          {(!isCreator && canOpenChat) && (
            <div className="mt-3">
              {showPrivateChat ? (
                <div className="rounded-[1.4rem] border border-white/10 bg-obsidian/95 shadow-2xl backdrop-blur-md">
                  <div className="p-3">
                    <PrivateChat taskId={task.id} otherUserId={task.creator_id} userId={user?.id} userName={user?.name} onClose={() => setShowPrivateChat(false)} />
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowPrivateChat(true)} className="ml-auto mt-2 block rounded-full border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-obsidian shadow-lg" title="Start a private chat with the task owner" aria-label="Message task owner">
                  Message Task Owner
                </button>
              )}
            </div>
          )}
      </Card>

      {taskActions.length > 0 ? (
        <Card>
          <div className="flex flex-wrap gap-3">{taskActions}</div>
        </Card>
      ) : task.status === "OPEN" && !isAuthenticatedUser ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text">Want to take up this task?</p>
              <p className="text-sm text-text/70">Log in to submit a proposal and start negotiation with the creator.</p>
            </div>
            <Link to="/auth" className="btn-primary inline-flex justify-center">
              Login to Propose
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-text/70">No task actions are available for this task right now.</p>
        </Card>
      )}

      {canOpenChat && (isInProgress || isInNegotiation || task.status === "OPEN") && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(92vw,28rem)]">
          {showChat ? (
            <div className="rounded-[1.4rem] border border-white/10 bg-obsidian/95 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold">Project Chat</h2>
                  <p className="text-xs text-text/60">
                    {isCreator
                      ? "Talk with people who submitted proposals."
                      : "Keep the discussion here after you submit a proposal."}
                  </p>
                </div>
                <button onClick={() => setShowChat(false)} className="text-sm text-text/70 hover:text-text">
                  Hide
                </button>
              </div>
                <div className="p-3">
                <ChatComponent taskId={task.id} userId={user?.id} userName={user?.name} taskStatus={task.status} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowChat(true)}
              className="ml-auto block rounded-full border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-obsidian shadow-lg"
            >
              Open Project Chat
            </button>
          )}
        </div>
      )}

      {isCreator && ["OPEN", "IN_NEGOTIATION"].includes(task.status) && proposals.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold">Proposals ({proposals.length})</h2>
          <div className="mt-4 space-y-3">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="rounded-2xl border border-white/10 bg-surface/80 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold">{proposal.solver_name}</p>
                    <p className="text-sm text-text/60">Bid: Rs {proposal.bid_amount}</p>
                    <p className="mt-2 text-sm text-text/80">{proposal.message}</p>
                  </div>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-text/70">{proposal.status}</span>
                </div>

                {proposal.status === "SUBMITTED" && task.status === "OPEN" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleAcceptProposal(proposal.id)} className="btn-primary text-sm">
                      Accept
                    </button>
                    <button className="btn-secondary text-sm">Reject</button>
                  </div>
                )}

                {proposal.status === "ACCEPTED" && task.status === "IN_NEGOTIATION" && (
                  <button
                    onClick={() => {
                      setSelectedProposal(proposal.id);
                      handleConfirmNegotiation(proposal.id);
                    }}
                    className="btn-primary mt-3 text-sm"
                  >
                    Confirm as Selected
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/80 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
