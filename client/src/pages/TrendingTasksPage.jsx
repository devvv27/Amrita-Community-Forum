import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TrendingUp, Flame, Star, Loader, Clock } from 'lucide-react';
import Card from "../components/Card";
import Button from "../components/Button";

export default function TrendingTasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrendingTasks = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/tasks-advanced/trending?limit=20');
        setTasks(response.data.tasks);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch trending tasks');
      } finally {
        setLoading(false);
      }
    };
    fetchTrendingTasks();
  }, []);

  const getTrendLabel = (status) => {
    const labels = {
      HOT: 'HOT',
      COMPETITIVE: 'COMPETITIVE',
      NEW: 'NEW',
      ACTIVE: 'ACTIVE',
    };
    return labels[status] || 'ACTIVE';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 text-text animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-text" />
            <h1 className="text-4xl font-bold text-text">Trending Tasks</h1>
          </div>
          <p className="text-text/70">Discover the most active tasks right now</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 border border-white/10 rounded-lg text-text">
            {error}
          </div>
        )}

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task, idx) => {
            const trendLabel = getTrendLabel(task.trend_status);

            return (
              <div
                key={task.id}
                className="group card overflow-hidden transition transform hover:scale-[1.01]"
              >
                {/* Rank indicator */}
                <div className="absolute top-4 right-4 bg-white/10 text-text px-3 py-1 rounded-full text-sm font-semibold">
                  #{idx + 1}
                </div>

                <div className="p-6">
                  <div className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full mb-3 text-xs font-semibold text-text">
                    {task.trend_status === 'HOT' ? <Flame className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                    <span>{trendLabel}</span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-semibold text-text group-hover:text-white transition mb-2 line-clamp-2">
                    {task.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-text/70 line-clamp-2 mb-3">
                    {task.description}
                  </p>

                  {/* Creator Info */}
                  <div className="flex items-center gap-2 mb-4 text-xs text-text/60">
                    <span>by {task.creator_name}</span>
                  </div>

                  {/* Task Meta */}
                  <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-text/60">Budget</span>
                      <span className="text-text font-semibold">${task.budget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text/60">Difficulty</span>
                      <span className={`font-semibold ${
                        task.difficulty === 'BEGINNER' ? 'text-text' :
                        task.difficulty === 'INTERMEDIATE' ? 'text-text/80' :
                        'text-text/60'
                      }`}>
                        {task.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Engagement Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-text">{task.views || 0}</div>
                      <div className="text-xs text-text/60">Views</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-text">{task.proposal_count || 0}</div>
                      <div className="text-xs text-text/60">Proposals</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-text">{task.save_count || 0}</div>
                      <div className="text-xs text-text/60">Saves</div>
                    </div>
                  </div>

                  {/* Trend Score */}
                  {task.trend_score && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-text/60">Trend Score</span>
                        <span className="text-sm font-semibold text-text">{task.trend_score.toFixed(1)}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${Math.min((task.trend_score / 200) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {task.tech_stack && task.tech_stack.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-text/60 mb-2">Tech Stack</div>
                      <div className="flex flex-wrap gap-1">
                        {task.tech_stack.slice(0, 4).map((tech, i) => (
                          <span key={i} className="text-xs bg-white/10 text-text px-2 py-1 rounded">
                            {tech}
                          </span>
                        ))}
                        {task.tech_stack.length > 4 && (
                          <span className="text-xs text-text/50 px-2 py-1">
                            +{task.tech_stack.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deadline */}
                  <div className="flex items-center gap-2 text-xs text-text/60 mb-4">
                    <Clock className="w-3 h-3" />
                    <span>
                      Deadline: {new Date(task.deadline).toLocaleDateString()}
                    </span>
                  </div>

                  {/* CTA Button */}
                  <Button type="button" onClick={() => navigate(`/task/${task.id}`)} className="w-full">
                    View Task
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-12 text-text/60">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-text/40" />
            <p>No tasks found in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
