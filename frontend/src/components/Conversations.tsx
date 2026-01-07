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
  console.log('🔵 Conversations component mounted, storeId:', storeId);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    console.log('🔵 Conversations useEffect triggered, storeId:', storeId);
    if (storeId) {
      loadConversations();
    } else {
      console.error('❌ Store ID is missing!');
      setError('Store ID is missing');
      setLoading(false);
    }
  }, [storeId]);

  const loadConversations = async () => {
    try {
      console.log('🔵 loadConversations called for storeId:', storeId);
      setLoading(true);
      setError(null);

      const url = `/brand/${storeId}/conversations`;
      console.log('🔵 Fetching from:', url);

      const response = await axios.get(url);
      console.log('✅ Conversations loaded:', response.data.data?.length || 0, 'conversations');

      setConversations(response.data.data);
    } catch (err: any) {
      console.error('❌ Failed to load conversations:', err);
      console.error('❌ Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      console.log('🔵 Loading complete');
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

  console.log('🔵 Render state:', { loading, error, conversationsCount: conversations.length });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', marginBottom: '20px', fontSize: '16px' }}>❌ {error}</p>
        <button
          onClick={loadConversations}
          style={{
            padding: '10px 20px',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '350px 1fr',
      height: '70vh',
      backgroundColor: 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Left: Conversations List */}
      <div style={{
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#fafafa'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>💬 Conversations</h3>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>{conversations.length} total</p>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 16px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '9px', fontSize: '16px' }}>🔍</span>
          </div>
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
              No conversations found
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversationDetail(conv.id)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  backgroundColor: selectedConversation?.id === conv.id ? '#f3f4f6' : 'white',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#e0e7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    👤
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        Visitor {conv.visitor_id.substring(0, 8)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {formatDate(conv.updated_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '6px'
                    }}>
                      {conv.last_message?.substring(0, 60)}
                      {conv.last_message?.length > 60 && '...'}
                    </div>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      💬 {conv.message_count} messages
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Conversation Detail */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedConversation ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ca3af',
            padding: '40px'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>💬</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
              Select a conversation
            </h3>
            <p style={{ fontSize: '14px', textAlign: 'center' }}>
              Choose a conversation from the list to view the full chat history
            </p>
          </div>
        ) : loadingDetail ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f4f6',
              borderTop: '4px solid #667eea',
              borderRadius: '50%'
            }}></div>
            <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>Loading messages...</p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fafafa'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                  Conversation Details
                </h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                  <span>👤 {selectedConversation.visitor_id.substring(0, 12)}...</span>
                  <span>🕒 {formatDate(selectedConversation.created_at)}</span>
                  <span>💬 {selectedConversation.messages.length} messages</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedConversation(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: '#ffffff'
            }}>
              {selectedConversation.messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: message.role === 'user' ? '#dbeafe' : '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        {message.role === 'user' ? 'Customer' : 'AI Assistant'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#374151',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {message.content}
                    </div>
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
