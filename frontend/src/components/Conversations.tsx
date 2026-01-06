import { useState, useEffect } from 'react';
import axios from '../lib/axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  session_id: string;
  visitor_id: string;
  store_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

interface ConversationsProps {
  storeId: string;
}

export default function Conversations({ storeId }: ConversationsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (storeId) {
      loadConversations();
    } else {
      setError('Store ID is missing');
      setLoading(false);
    }
  }, [storeId]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/brand/${storeId}/conversations`);
      setConversations(response.data.data);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      setError(err.response?.data?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadConversationDetail = async (conversationId: string) => {
    try {
      setLoadingDetail(true);
      const response = await axios.get(`/brand/${storeId}/conversations/${conversationId}`);
      setSelectedConversation(response.data.data);
    } catch (err: any) {
      console.error('Failed to load conversation detail:', err);
      alert('Failed to load conversation details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.last_message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.visitor_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', marginBottom: '16px' }}>❌ {error}</p>
        <button
          onClick={loadConversations}
          style={{ padding: '8px 16px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: '600px', gap: '16px', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      {/* Conversations List */}
      <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="conversations-header">
          <h3>💬 Customer Conversations</h3>
          <p className="conversations-subtitle">{conversations.length} total conversations</p>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Conversation Items */}
        <div className="conversation-items">
          {filteredConversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => loadConversationDetail(conv.id)}
              >
                <div className="conversation-avatar">👤</div>
                <div className="conversation-info">
                  <div className="conversation-header-row">
                    <span className="visitor-id">Visitor {conv.visitor_id.substring(0, 8)}</span>
                    <span className="conversation-time">{formatDate(conv.updated_at)}</span>
                  </div>
                  <div className="conversation-preview">
                    {conv.last_message?.substring(0, 80)}
                    {conv.last_message?.length > 80 && '...'}
                  </div>
                  <div className="conversation-meta">
                    <span className="message-count">💬 {conv.message_count} messages</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation Detail */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedConversation ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Select a conversation</h3>
            <p style={{ fontSize: '14px' }}>Choose a conversation from the list to view the full chat history</p>
          </div>
        ) : loadingDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #667eea', borderRadius: '50%' }}></div>
            <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading messages...</p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="detail-header">
              <div className="detail-header-left">
                <h3>Conversation Details</h3>
                <div className="detail-meta">
                  <span>👤 Visitor: {selectedConversation.visitor_id.substring(0, 12)}...</span>
                  <span>🕒 Started: {formatDate(selectedConversation.created_at)}</span>
                  <span>💬 {selectedConversation.messages.length} messages</span>
                </div>
              </div>
              <button
                className="btn-close-detail"
                onClick={() => setSelectedConversation(null)}
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {selectedConversation.messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`message ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-role">
                        {message.role === 'user' ? 'Customer' : 'AI Assistant'}
                      </span>
                      <span className="message-time">{formatTime(message.created_at)}</span>
                    </div>
                    <div className="message-text">{message.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
