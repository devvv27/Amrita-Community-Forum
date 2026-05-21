import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Card from "../components/Card";
import Button from "../components/Button";

export default function RatingsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [user, setUser] = useState(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ratedUser, setRatedUser] = useState(null);
  const [existingRatings, setExistingRatings] = useState([]);

  useEffect(() => {
    const userData = localStorage.getItem("acf_session");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchTaskData();
  }, [taskId]);

  const fetchTaskData = async () => {
    try {
      const taskResponse = await api.get(`/tasks/${taskId}`);
      setTask(taskResponse.data.task);

      const ratingsResponse = await api.get(`/ratings/${taskId}`);
      setExistingRatings(ratingsResponse.data.ratings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data");
    }
  };

  const selectUserToRate = (userId, userName) => {
    setRatedUser({ id: userId, name: userName });
    setRating(0);
    setFeedback("");
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();

    if (!rating) {
      setError("Please select a rating");
      return;
    }

    if (!ratedUser) {
      setError("Please select a user to rate");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.post(`/ratings/${taskId}`, {
        ratedUserId: ratedUser.id,
        ratingScore: rating,
        feedback: feedback || null,
      });

      alert("Rating submitted successfully!");
      fetchTaskData();
      setRatedUser(null);
      setRating(0);
      setFeedback("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit rating");
    } finally {
      setLoading(false);
    }
  };

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text/60">Loading task details...</p>
      </div>
    );
  }

  const otherUser =
    task.creator_id === user?.id
      ? { id: task.assigned_solver_id, name: task.solver_name }
      : { id: task.creator_id, name: task.creator_name };

  const hasRatedOtherUser = existingRatings.some(
    (r) => r.rater_id === user?.id && r.rated_user_id === otherUser.id
  );

  return (
    <section className="space-y-6 fade-in max-w-2xl">
      <Card>
        <h1 className="text-2xl font-semibold">Rate & Provide Feedback</h1>
        <p className="text-sm text-text/60 mt-1">Task: {task.title}</p>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Rating Form */}
      {!hasRatedOtherUser && (
        <form onSubmit={handleSubmitRating} className="card space-y-4">
          <div>
            <p className="text-sm font-medium mb-3">Select user to rate</p>
            <div className="space-y-2">
              <Button
                type="button"
                className={`w-full p-3 text-left ${
                  ratedUser?.id === otherUser.id ? "border-neon bg-neon/10" : "border-white/10 hover:border-neon/30"
                }`}
                onClick={() => selectUserToRate(otherUser.id, otherUser.name)}
              >
                <p className="font-medium">{otherUser.name}</p>
                <p className="text-xs text-text/60">{task.creator_id === user?.id ? "Task Solver" : "Task Creator"}</p>
              </Button>
            </div>
          </div>

          {ratedUser && (
            <>
              {/* Rating Stars */}
              <div>
                <p className="text-sm font-medium mb-3">Rating (1-5 stars)</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button key={star} type="button" variant="ghost" className={`text-3xl ${star <= rating ? "text-neon" : "text-muted"}`} onClick={() => setRating(star)}>
                      ★
                    </Button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-sm text-text/60 mt-1">
                    Rating: {rating} star{rating !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-sm font-medium mb-2">Feedback (Optional)</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your experience working on this task..."
                  className="w-full h-32 px-3 py-2 border border-white/10 rounded-lg text-sm bg-surface/80 text-text focus:outline-none focus:ring-2 focus:ring-neon/50"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? "Submitting..." : "Submit Rating"}
                </button>
                <button
                  type="button"
                  onClick={() => setRatedUser(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Existing Ratings */}
      {existingRatings.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Ratings for this Task</h2>
          <div className="space-y-4">
            {existingRatings.map((r) => (
              <div key={r.id} className="border border-white/10 rounded-lg p-4 bg-surface/80">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{r.rater_name}</p>
                    <p className="text-sm text-text/60">rated {r.feedback ? r.rater_name : "anonymously"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-neon">
                      {"★".repeat(r.rating_score)}{"☆".repeat(5 - r.rating_score)}
                    </p>
                    <p className="text-xs text-text/60">{r.rating_score}/5</p>
                  </div>
                </div>
                {r.feedback && (
                  <p className="text-sm text-text/80 mt-2">{r.feedback}</p>
                )}
                <p className="text-xs text-muted mt-2">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRatedOtherUser && (
        <div className="card bg-green-50 border border-green-200">
          <p className="text-sm text-green-900">✓ You have already rated this user for this task</p>
        </div>
      )}
    </section>
  );
}
