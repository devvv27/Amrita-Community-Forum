import { useEffect, useState } from "react";
import { apiCall } from "../lib/api";
import Card from "../components/Card";
import Button from "../components/Button";
import { useToast } from "../components/ToastProvider";
import Badge from "../components/Badge";

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
    name: "",
    description: "",
    isPublic: false,
  });
  const [memberForm, setMemberForm] = useState({
    userId: "",
    role: "MEMBER",
  });
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const toast = useToast();

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const data = await apiCall("/api/teams", { method: "GET" });
      setTeams(data.teams || []);
      if (data.teams?.length > 0 && !selectedTeam) {
        fetchTeamDetails(data.teams[0].id);
      }
    } catch (err) {
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamDetails = async (teamId) => {
    try {
      const data = await apiCall(`/api/teams/${teamId}`, { method: "GET" });
      setSelectedTeam(data);
    } catch (err) {
      setError("Failed to load team details");
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Team name is required");
      return;
    }

    try {
      setLoading(true);
      const data = await apiCall("/api/teams", {
        method: "POST",
        body: form,
      });

      setTeams([...teams, data.team]);
      fetchTeamDetails(data.team.id);
      setForm({ name: "", description: "", isPublic: false });
      setShowCreateForm(false);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberForm.userId) {
      setError("Please select a user");
      return;
    }

    try {
      setLoading(true);
      await apiCall(`/api/teams/${selectedTeam.team.id}/members`, {
        method: "POST",
        body: memberForm,
      });

      fetchTeamDetails(selectedTeam.team.id);
      setMemberForm({ userId: "", role: "MEMBER" });
      setShowAddMemberForm(false);
      setUserSearch("");
      setError("");
    } catch (err) {
      setError(err.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Remove this member from the team?")) return;

    try {
      setLoading(true);
      await apiCall(`/api/teams/${selectedTeam.team.id}/members/${memberId}`, {
        method: "DELETE",
      });

      fetchTeamDetails(selectedTeam.team.id);
    } catch (err) {
      setError(err.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirm("Delete this team? This action cannot be undone.")) return;

    try {
      setLoading(true);
      await apiCall(`/api/teams/${selectedTeam.team.id}`, {
        method: "DELETE",
      });

      setTeams(teams.filter((t) => t.id !== selectedTeam.team.id));
      setSelectedTeam(null);
    } catch (err) {
      setError(err.message || "Failed to delete team");
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (q) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await apiCall(`/api/profile/search?q=${q}`, { method: "GET" });
      setSearchResults(data.people || []);
    } catch (err) {
      setSearchResults([]);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  return (
          <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-lg border border-slate-700 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-cyan-400">Your Teams</h2>
                <Button onClick={() => setShowCreateForm(!showCreateForm)}>+</Button>
              </div>

                  {showCreateForm && (
                <form onSubmit={handleCreateTeam} className="mb-6 space-y-3 pb-6 border-b border-slate-700">
                  <input
                    type="text"
                    placeholder="Team name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm focus:outline-none focus:border-cyan-500 h-20 resize-none"
                  />
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span>Public team</span>
                  </label>
                  <Button type="submit" className="w-full">Create Team</Button>
                </form>
              )}

              <div className="space-y-2">
                    {teams.length === 0 ? (
                  <p className="text-slate-400 text-sm">No teams yet. Create one to get started!</p>
                ) : (
                  teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => fetchTeamDetails(team.id)}
                      className={`w-full text-left px-3 py-2 rounded transition ${
                        selectedTeam?.team.id === team.id
                          ? "bg-cyan-600/20 border border-cyan-500"
                          : "hover:bg-slate-800"
                      }`}
                    >
                      <div className="font-medium text-sm">{team.name}</div>
                      <div className="text-xs text-slate-400">{team.member_count} members</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Team Details */}
          <div className="lg:col-span-2">
            {selectedTeam ? (
              <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 space-y-6">
                {/* Team Header */}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h1 className="text-2xl font-bold text-cyan-400 mb-2">{selectedTeam.team.name}</h1>
                      <p className="text-slate-300">{selectedTeam.team.description || "No description"}</p>
                    </div>
                    {selectedTeam.team.current_user_role === "ADMIN" && (
                      <Button variant="danger" onClick={handleDeleteTeam}>Delete Team</Button>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-400">
                    <span>Created by: {selectedTeam.team.created_by_name}</span>
                    <span>{selectedTeam.team.is_public ? "Public" : "Private"}</span>
                  </div>
                </div>

                {/* Members Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-cyan-400">Members ({selectedTeam.members.length})</h2>
                    {selectedTeam.team.current_user_role === "ADMIN" && (
                      <Button onClick={() => setShowAddMemberForm(!showAddMemberForm)}>Add Member</Button>
                    )}
                  </div>

                  {showAddMemberForm && (
                    <form onSubmit={handleAddMember} className="mb-6 space-y-3 pb-6 border-b border-slate-700">
                      <div>
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={userSearch}
                          onChange={(e) => {
                            setUserSearch(e.target.value);
                            searchUsers(e.target.value);
                          }}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm focus:outline-none focus:border-cyan-500"
                        />
                        {searchResults.length > 0 && (
                          <div className="mt-2 max-h-40 overflow-y-auto bg-slate-800 border border-slate-600 rounded">
                            {searchResults.map((user) => (
                                  <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => {
                                          setMemberForm({ ...memberForm, userId: user.id });
                                          setUserSearch(user.name);
                                          setSearchResults([]);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
                                      >
                                        <div className="text-sm font-medium">{user.name}</div>
                                        <div className="text-xs text-slate-400">{user.email}</div>
                                      </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <select
                        value={memberForm.role}
                        onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm focus:outline-none focus:border-cyan-500"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        type="submit"
                        disabled={loading || !memberForm.userId}
                        className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded font-medium transition"
                      >
                        Add Member
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-700"
                      >
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-slate-400">{member.email}</div>
                          <div className="text-xs text-cyan-400 mt-1">{member.role}</div>
                        </div>
                        {selectedTeam.team.current_user_role === "ADMIN" && member.role !== "ADMIN" && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="px-2 py-1 text-red-400 hover:bg-red-600/20 rounded text-xs transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-lg border border-slate-700 p-12 text-center">
                <p className="text-slate-400">Select a team or create a new one to get started</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-900/30 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
