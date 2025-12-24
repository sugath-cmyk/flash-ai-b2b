import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    conversations: 0,
    documents: 0,
    teamMembers: 1,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [conversationsRes, documentsRes, teamRes] = await Promise.allSettled([
        axios.get('/ai/conversations'),
        axios.get('/documents'),
        axios.get('/teams/my-team'),
      ]);

      setStats({
        conversations: conversationsRes.status === 'fulfilled'
          ? conversationsRes.value.data.data.conversations.length
          : 0,
        documents: documentsRes.status === 'fulfilled'
          ? documentsRes.value.data.data.documents.length
          : 0,
        teamMembers: teamRes.status === 'fulfilled' && teamRes.value.data.data.team
          ? teamRes.value.data.data.team.members.length
          : 1,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Flash AI B2B</h1>
            <div className="flex items-center gap-4">
              <Link
                to="/profile"
                className="text-sm text-gray-700 hover:text-gray-900 font-medium"
              >
                {user?.firstName} {user?.lastName}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.firstName}!
          </h2>
          <p className="text-gray-600">
            Ready to leverage AI for your business?
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* AI Chat Card */}
          <Link
            to="/chat"
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">AI Chat</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Chat with AI assistants powered by Claude and GPT to get insights and answers.
            </p>
            <span className="text-primary-600 font-medium">Start chatting →</span>
          </Link>

          {/* Document Analysis Card */}
          <Link
            to="/documents"
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Upload and analyze documents with AI to extract insights and summaries.
            </p>
            <span className="text-green-600 font-medium">Upload document →</span>
          </Link>

          {/* Team Management Card */}
          <Link
            to="/team"
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Team</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Manage your team members and their access to AI features.
            </p>
            <span className="text-purple-600 font-medium">Manage team →</span>
          </Link>

          {/* Store Import Card */}
          <Link
            to="/stores"
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Store Import</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Import and extract data from your e-commerce stores automatically.
            </p>
            <span className="text-orange-600 font-medium">Import store →</span>
          </Link>
        </div>

        {/* Stats Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Conversations</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.conversations}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Documents Analyzed</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.documents}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Team Members</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.teamMembers}
            </div>
            <div className="text-xs text-gray-500 mt-1">Active</div>
          </div>
        </div>
      </main>
    </div>
  );
}
