import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  myRole: 'owner' | 'admin' | 'member';
  members: TeamMember[];
}

export default function Team() {
  const { user, logout } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const response = await axios.get('/teams/my-team');
      setTeam(response.data.data.team);
    } catch (error) {
      console.error('Failed to load team:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    try {
      await axios.post('/teams', {
        name: newTeamName,
        description: newTeamDescription,
      });
      setShowCreateTeam(false);
      setNewTeamName('');
      setNewTeamDescription('');
      await loadTeam();
      alert('Team created successfully!');
    } catch (error: any) {
      console.error('Failed to create team:', error);
      alert(error.response?.data?.error?.message || 'Failed to create team');
    }
  };

  const addMember = async () => {
    if (!newMemberEmail.trim() || !team) return;

    try {
      await axios.post(`/teams/${team.id}/members`, {
        email: newMemberEmail,
        role: newMemberRole,
      });
      setShowAddMember(false);
      setNewMemberEmail('');
      setNewMemberRole('member');
      await loadTeam();
      alert('Member added successfully!');
    } catch (error: any) {
      console.error('Failed to add member:', error);
      alert(error.response?.data?.error?.message || 'Failed to add member');
    }
  };

  const updateMemberRole = async (userId: string, newRole: 'admin' | 'member') => {
    if (!team) return;

    try {
      await axios.put(`/teams/${team.id}/members/${userId}`, { role: newRole });
      await loadTeam();
      alert('Member role updated successfully!');
    } catch (error: any) {
      console.error('Failed to update role:', error);
      alert(error.response?.data?.error?.message || 'Failed to update role');
    }
  };

  const removeMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) return;
    if (!team) return;

    try {
      await axios.delete(`/teams/${team.id}/members/${userId}`);
      await loadTeam();
      alert('Member removed successfully!');
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      alert(error.response?.data?.error?.message || 'Failed to remove member');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isAdmin = team?.myRole === 'owner' || team?.myRole === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
            </div>
            <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">Loading team...</p>
          </div>
        ) : !team ? (
          <div className="card">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Team Yet</h2>
              <p className="text-gray-600 mb-6">
                Create a team to collaborate with your colleagues
              </p>
              <button
                onClick={() => setShowCreateTeam(true)}
                className="btn-primary"
              >
                Create Team
              </button>
            </div>

            {showCreateTeam && (
              <div className="mt-8 border-t pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Team</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Name
                    </label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="input-field"
                      placeholder="e.g., Marketing Team"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Brief description of your team"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={createTeam} className="btn-primary">
                      Create Team
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateTeam(false);
                        setNewTeamName('');
                        setNewTeamDescription('');
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Team Info */}
            <div className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
                  {team.description && (
                    <p className="text-gray-600 mt-1">{team.description}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(team.myRole)}`}>
                  Your Role: {team.myRole}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {team.members.length} member{team.members.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Team Members */}
            <div className="card">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="btn-primary text-sm"
                  >
                    + Add Member
                  </button>
                )}
              </div>

              {showAddMember && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Member</h4>
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="Member's email address"
                      className="input-field"
                    />
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'member')}
                      className="input-field"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <div className="flex gap-3">
                      <button onClick={addMember} className="btn-primary text-sm">
                        Add Member
                      </button>
                      <button
                        onClick={() => {
                          setShowAddMember(false);
                          setNewMemberEmail('');
                        }}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {member.first_name[0]}{member.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                          {member.user_id === user?.id && (
                            <span className="text-gray-500 text-sm ml-2">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && member.role !== 'owner' ? (
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.user_id, e.target.value as 'admin' | 'member')}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(member.role)}`}>
                          {member.role}
                        </span>
                      )}
                      {isAdmin && member.role !== 'owner' && member.user_id !== user?.id && (
                        <button
                          onClick={() => removeMember(member.user_id, `${member.first_name} ${member.last_name}`)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
