import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader, AlertCircle, TrendingUp, Users, CheckCircle, Zap } from 'lucide-react';

export default function TeamAnalyticsPage({ teamId }) {
  const [analytics, setAnalytics] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get(`/api/teams/${teamId}/analytics`);
        setAnalytics(response.data.analytics);
        setTeamStats(response.data.teamStats);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
      fetchAnalytics();
    }
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        {error}
      </div>
    );
  }

  if (!analytics || !teamStats) {
    return <div className="text-center text-gray-400">No analytics data available</div>;
  }

  // Prepare chart data
  const chartData = (analytics.historical_metrics || [])
    .sort((a, b) => a.week_of_year - b.week_of_year)
    .map(m => ({
      week: `W${m.week_of_year}`,
      tasksCreated: m.tasks_created || 0,
      tasksCompleted: m.tasks_completed || 0,
      efficiency: m.efficiency_score || 0,
      activeMembers: m.members_active || 0,
      earnings: m.total_earnings || 0,
    }));

  const neutralFill = '#E6EDF3';
  const taskStatusData = [
    { name: 'Open', value: teamStats.open_tasks || 0, fill: neutralFill },
    { name: 'In Progress', value: teamStats.in_progress_tasks || 0, fill: neutralFill },
    { name: 'Completed', value: teamStats.completed_tasks || 0, fill: neutralFill },
  ];

  const COLORS = [neutralFill, neutralFill, neutralFill, neutralFill];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={CheckCircle}
          label="Total Tasks"
          value={teamStats.total_tasks || 0}
          trend={teamStats.open_tasks}
          trendLabel="Open"
          color="cyan"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Complexity"
          value={(teamStats.avg_complexity || 0).toFixed(1)}
          trend={`${(teamStats.team_success_rate * 100 || 0).toFixed(0)}%`}
          trendLabel="Success Rate"
          color="emerald"
        />
        <MetricCard
          icon={Users}
          label="Total Proposals"
          value={teamStats.total_proposals || 0}
          trend={`$${(teamStats.avg_budget || 0).toLocaleString()}`}
          trendLabel="Avg Budget"
          color="purple"
        />
        <MetricCard
          icon={Zap}
          label="Team Performance"
          value={`${(teamStats.efficiency_score || 0).toFixed(0)}/100`}
          trend={teamStats.total_earnings?.toLocaleString()}
          trendLabel="Total Earnings"
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks Over Time */}
        <div className="bg-[#1a1f3a] border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text mb-4">Task Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" />
              <XAxis dataKey="week" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'var(--color-ink)' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="tasksCreated"
                stroke={neutralFill}
                name="Created"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="tasksCompleted"
                stroke={neutralFill}
                name="Completed"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Task Status Distribution */}
        <div className="bg-[#1a1f3a] border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text mb-4">Task Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={taskStatusData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value, percent }) =>
                  `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {taskStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Efficiency Score */}
        <div className="bg-[#1a1f3a] border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text mb-4">Team Efficiency Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" />
              <XAxis dataKey="week" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="efficiency" fill={neutralFill} name="Efficiency Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Members */}
        <div className="bg-[#1a1f3a] border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text mb-4">Active Members</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" />
              <XAxis dataKey="week" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="activeMembers"
                stroke={neutralFill}
                name="Active Members"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current Week Stats */}
      <div className="bg-[#1a1f3a] border border-cyan-500/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-cyan-400 mb-4">Current Week Performance</h3>
        {analytics.current_week && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem
              label="Tasks Created"
              value={analytics.current_week.tasks_created || 0}
            />
            <StatItem
              label="Tasks Completed"
              value={analytics.current_week.tasks_completed || 0}
            />
            <StatItem
              label="Active Members"
              value={analytics.current_week.members_active || 0}
            />
            <StatItem
              label="Efficiency Score"
              value={`${(analytics.current_week.efficiency_score || 0).toFixed(0)}/100`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, trend, trendLabel, color }) {
  const colorClass = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  }[color] || 'text-cyan-400';

  const bgClass = {
    cyan: 'bg-cyan-500/10 border-cyan-500/30',
    emerald: 'bg-emerald-500/10 border-emerald-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    orange: 'bg-orange-500/10 border-orange-500/30',
  }[color] || 'bg-cyan-500/10 border-cyan-500/30';

  return (
    <div className={`${bgClass} border rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
          {trend && (
            <p className="text-xs text-gray-600 mt-2">
              {trendLabel}: <span className={`font-semibold ${colorClass}`}>{trend}</span>
            </p>
          )}
        </div>
        <Icon className={`w-6 h-6 ${colorClass} opacity-50`} />
      </div>
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-3 border border-cyan-500/10">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-cyan-400">{value}</p>
    </div>
  );
}
