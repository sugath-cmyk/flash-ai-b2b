import React, { useState, useEffect } from 'react';
import axios from '../lib/axios';
import '../styles/AdminAnalytics.css';
import AnalyticsDiagnostic from './AnalyticsDiagnostic';

interface QueryStats {
  totalQueries: number;
  uniqueConversations: number;
  avgMessagesPerConversation: number;
  cacheHitRate: number;
  avgTokensPerQuery: number;
  cacheStats: {
    totalCachedResponses: number;
    cacheHitRate: number;
    cacheHitCount: number;
    cacheMissCount: number;
    costSavings: {
      tokensSaved: number;
      estimatedDollarsSaved: number;
    };
    topCachedQueries: Array<{
      query: string;
      hitCount: number;
      category: string;
    }>;
  };
  timeRange: {
    start: string;
    end: string;
    days: number;
  };
}

interface PopularQuery {
  query: string;
  count: number;
  category: string;
  topics: string[];
}

interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
}

interface Query {
  id: string;
  conversationId: string;
  sessionId: string;
  query: string;
  response: string;
  category: string;
  topics: string[];
  intent: string;
  sentiment: string;
  cached: boolean;
  tokens: number;
  createdAt: string;
}

interface AdminAnalyticsProps {
  storeId: string;
}

export default function AdminAnalytics({ storeId }: AdminAnalyticsProps) {
  const [stats, setStats] = useState<QueryStats | null>(null);
  const [popularQueries, setPopularQueries] = useState<PopularQuery[]>([]);
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [recentQueries, setRecentQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  useEffect(() => {
    loadAnalytics();
  }, [storeId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Load all analytics data in parallel
      const [statsRes, popularRes, categoriesRes, queriesRes] = await Promise.all([
        axios.get(`/brand/${storeId}/query-analytics/stats?days=${timeRange}`),
        axios.get(`/brand/${storeId}/query-analytics/popular?days=${timeRange}&limit=10`),
        axios.get(`/brand/${storeId}/query-analytics/categories?days=${timeRange}`),
        axios.get(`/brand/${storeId}/query-analytics/search?page=1&limit=50`)
      ]);

      // Safely set data with fallbacks
      if (statsRes.data?.success && statsRes.data?.data) {
        setStats(statsRes.data.data);
      }

      if (popularRes.data?.success && popularRes.data?.data?.popularQueries) {
        setPopularQueries(popularRes.data.data.popularQueries);
      }

      if (categoriesRes.data?.success && categoriesRes.data?.data?.categories) {
        setCategories(categoriesRes.data.data.categories);
      }

      if (queriesRes.data?.success && queriesRes.data?.data?.queries) {
        setRecentQueries(queriesRes.data.data.queries);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      // Set empty states on error
      setStats(null);
      setPopularQueries([]);
      setCategories([]);
      setRecentQueries([]);
    } finally {
      setLoading(false);
    }
  };

  const searchQueries = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        ...(searchTerm && { searchTerm }),
        ...(selectedCategory && { category: selectedCategory })
      });

      const response = await axios.get(`/brand/${storeId}/query-analytics/search?${params}`);
      setRecentQueries(response.data.data.queries);
    } catch (error) {
      console.error('Failed to search queries:', error);
    }
  };

  const exportData = async () => {
    try {
      const params = new URLSearchParams({
        format: exportFormat,
        ...(searchTerm && { searchTerm }),
        ...(selectedCategory && { category: selectedCategory })
      });

      const response = await axios.get(`/brand/${storeId}/query-analytics/export?${params}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `queries_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  // Show helpful message if no data
  const hasNoData = !stats && popularQueries.length === 0 && categories.length === 0 && recentQueries.length === 0;

  if (hasNoData) {
    return (
      <div className="admin-analytics">
        <div className="analytics-header">
          <div>
            <h1>Query Analytics & Intelligence</h1>
            <p>Actionable insights from customer conversations</p>
          </div>
        </div>

        <div className="empty-state" style={{ padding: '80px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>📊</div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1a202c', marginBottom: '16px' }}>
            No Analytics Data Yet
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
            Start chatting with your widget to generate analytics! Once customers ask questions, you'll see:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '800px', margin: '0 auto 32px', textAlign: 'left' }}>
            <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏷️</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Auto-Categorization</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Queries organized by type</div>
            </div>
            <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💬</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Popular Questions</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Most asked queries</div>
            </div>
            <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Cost Savings</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Smart caching stats</div>
            </div>
            <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💾</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Export Data</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>CSV/JSON downloads</div>
            </div>
          </div>
          <div style={{ padding: '24px', background: '#e0e7ff', borderRadius: '12px', maxWidth: '600px', margin: '0 auto' }}>
            <p style={{ fontSize: '14px', color: '#4338ca', fontWeight: '600', marginBottom: '8px' }}>
              💡 How to Generate Data:
            </p>
            <ol style={{ textAlign: 'left', color: '#4338ca', fontSize: '14px', paddingLeft: '20px' }}>
              <li>Install the widget on your product pages</li>
              <li>Chat with the widget (ask questions about products)</li>
              <li>Refresh this page to see analytics appear!</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      {/* Diagnostics Tool */}
      <AnalyticsDiagnostic storeId={storeId} />

      {/* Header */}
      <div className="analytics-header">
        <div>
          <h1>Query Analytics & Intelligence</h1>
          <p>Actionable insights from customer conversations</p>
        </div>

        <div className="time-range-selector">
          <button
            className={timeRange === 7 ? 'active' : ''}
            onClick={() => setTimeRange(7)}
          >
            Last 7 Days
          </button>
          <button
            className={timeRange === 30 ? 'active' : ''}
            onClick={() => setTimeRange(30)}
          >
            Last 30 Days
          </button>
          <button
            className={timeRange === 90 ? 'active' : ''}
            onClick={() => setTimeRange(90)}
          >
            Last 90 Days
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">💬</div>
            <div className="metric-content">
              <div className="metric-label">Total Queries</div>
              <div className="metric-value">{stats.totalQueries.toLocaleString()}</div>
              <div className="metric-subtitle">{stats.uniqueConversations} conversations</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">⚡</div>
            <div className="metric-content">
              <div className="metric-label">Cache Hit Rate</div>
              <div className="metric-value">{(stats.cacheStats.cacheHitRate * 100).toFixed(1)}%</div>
              <div className="metric-subtitle">{stats.cacheStats.cacheHitCount} hits</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">💰</div>
            <div className="metric-content">
              <div className="metric-label">Cost Savings</div>
              <div className="metric-value">${stats.cacheStats.costSavings.estimatedDollarsSaved.toFixed(2)}</div>
              <div className="metric-subtitle">{stats.cacheStats.costSavings.tokensSaved.toLocaleString()} tokens saved</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🤖</div>
            <div className="metric-content">
              <div className="metric-label">Avg Tokens/Query</div>
              <div className="metric-value">{stats.avgTokensPerQuery}</div>
              <div className="metric-subtitle">{stats.avgMessagesPerConversation.toFixed(1)} msgs/conv</div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="section-card">
          <h2>Query Categories</h2>
          <p className="section-subtitle">Understanding what customers ask about</p>

          <div className="category-grid">
            {categories.map((cat) => (
              <div key={cat.category} className="category-card">
                <div className="category-header">
                  <span className="category-name">{cat.category.replace(/_/g, ' ')}</span>
                  <span className="category-count">{cat.count}</span>
                </div>
                <div className="category-bar">
                  <div
                    className="category-bar-fill"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                <div className="category-percentage">{cat.percentage.toFixed(1)}%</div>

                {cat.topQueries.length > 0 && (
                  <div className="category-top-queries">
                    <div className="top-queries-label">Top questions:</div>
                    {cat.topQueries.map((q, idx) => (
                      <div key={idx} className="top-query-item">
                        "{q.query.substring(0, 60)}{q.query.length > 60 ? '...' : ''}"
                        <span className="query-count">({q.count})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Queries */}
      {popularQueries.length > 0 && (
        <div className="section-card">
          <h2>Most Asked Questions</h2>
          <p className="section-subtitle">Frequently asked questions reveal customer pain points</p>

          <div className="popular-queries-list">
            {popularQueries.map((query, idx) => (
              <div key={idx} className="popular-query-item">
                <div className="query-rank">#{idx + 1}</div>
                <div className="query-content">
                  <div className="query-text">{query.query}</div>
                  <div className="query-meta">
                    <span className="query-category">{query.category}</span>
                    {query.topics.length > 0 && (
                      <span className="query-topics">
                        Topics: {query.topics.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="query-count-badge">{query.count}x</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cached Queries */}
      {stats && stats.cacheStats.topCachedQueries.length > 0 && (
        <div className="section-card">
          <h2>Most Cached Responses</h2>
          <p className="section-subtitle">Queries that save the most AI costs</p>

          <div className="cached-queries-list">
            {stats.cacheStats.topCachedQueries.map((query, idx) => (
              <div key={idx} className="cached-query-item">
                <div className="cached-icon">⚡</div>
                <div className="cached-content">
                  <div className="cached-query">{query.query}</div>
                  <div className="cached-meta">
                    <span className="cached-category">{query.category}</span>
                  </div>
                </div>
                <div className="cached-hits">{query.hitCount} hits</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="section-card">
        <div className="search-header">
          <h2>Query Search & Export</h2>
          <div className="export-controls">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
              className="format-select"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button onClick={exportData} className="export-button">
              Export Data
            </button>
          </div>
        </div>

        <div className="search-filters">
          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category.replace(/_/g, ' ')} ({cat.count})
              </option>
            ))}
          </select>

          <button onClick={searchQueries} className="search-button">
            Search
          </button>
        </div>

        {/* Recent Queries Table */}
        <div className="queries-table-container">
          <table className="queries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Query</th>
                <th>Category</th>
                <th>Topics</th>
                <th>Cached</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {recentQueries.map((query) => (
                <tr key={query.id}>
                  <td className="date-cell">
                    {new Date(query.createdAt).toLocaleDateString()}
                    <span className="time-cell">
                      {new Date(query.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="query-cell">
                    <div className="query-text-preview">
                      {query.query.substring(0, 80)}
                      {query.query.length > 80 ? '...' : ''}
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{query.category || 'general'}</span>
                  </td>
                  <td className="topics-cell">
                    {query.topics.slice(0, 2).join(', ')}
                  </td>
                  <td>
                    {query.cached ? (
                      <span className="cached-badge">⚡ Cached</span>
                    ) : (
                      <span className="ai-badge">🤖 AI</span>
                    )}
                  </td>
                  <td className="tokens-cell">{query.tokens || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {recentQueries.length === 0 && (
            <div className="empty-state">
              <p>No queries found matching your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
