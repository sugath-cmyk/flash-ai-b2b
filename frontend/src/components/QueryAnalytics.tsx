import { useState, useEffect } from 'react';
import axios from '../lib/axios';
import '../styles/QueryAnalytics.css';

interface QueryAnalyticsSummary {
  overview: {
    totalQueries: number;
    uniqueConversations: number;
    avgMessagesPerConversation: number;
    cacheHitRate: number;
    avgTokensPerQuery: number;
    timeRange: {
      start: string;
      end: string;
      days: number;
    };
  };
  popularQueries: Array<{
    query: string;
    count: number;
    category: string;
    topics: string[];
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    percentage: number;
    topQueries: Array<{
      query: string;
      count: number;
    }>;
  }>;
  cachePerformance: {
    hitRate: number;
    totalCached: number;
    savings: {
      tokensSaved: number;
      estimatedDollarsSaved: number;
    };
  };
}

interface QueryAnalyticsProps {
  storeId: string;
}

export default function QueryAnalytics({ storeId }: QueryAnalyticsProps) {
  const [summary, setSummary] = useState<QueryAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [storeId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `/brand/${storeId}/query-analytics/summary?days=${timeRange}`
      );
      setSummary(response.data.data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const response = await axios.get(
        `/brand/${storeId}/query-analytics/export?format=${format}&days=${timeRange}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `queries_export_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data');
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      ingredients: '🧬',
      product_inquiry: '💬',
      usage_instructions: '📖',
      shipping: '📦',
      returns: '↩️',
      pricing: '💰',
      safety: '⚠️',
      comparison: '🔍',
      general: '❓'
    };
    return icons[category] || '📝';
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      ingredients: 'Ingredients',
      product_inquiry: 'Product Questions',
      usage_instructions: 'Usage & How-To',
      shipping: 'Shipping',
      returns: 'Returns & Refunds',
      pricing: 'Pricing',
      safety: 'Safety Concerns',
      comparison: 'Product Comparisons',
      general: 'General Inquiries'
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="query-analytics-loading">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="query-analytics-error">
        <p>❌ {error}</p>
        <button onClick={loadAnalytics} className="btn-retry">Retry</button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="query-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div>
          <h2>📊 Customer Query Analytics</h2>
          <p className="analytics-subtitle">
            Insights from customer conversations (Last {timeRange} days)
          </p>
        </div>
        <div className="analytics-actions">
          {/* Time Range Selector */}
          <div className="time-range-selector">
            <button
              className={timeRange === 7 ? 'active' : ''}
              onClick={() => setTimeRange(7)}
            >
              7 Days
            </button>
            <button
              className={timeRange === 30 ? 'active' : ''}
              onClick={() => setTimeRange(30)}
            >
              30 Days
            </button>
            <button
              className={timeRange === 90 ? 'active' : ''}
              onClick={() => setTimeRange(90)}
            >
              90 Days
            </button>
          </div>

          {/* Export Buttons */}
          <div className="export-buttons">
            <button onClick={() => exportData('csv')} className="btn-export">
              📄 Export CSV
            </button>
            <button onClick={() => exportData('json')} className="btn-export">
              📋 Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <p className="stat-label">Total Queries</p>
            <p className="stat-value">{summary.overview.totalQueries.toLocaleString()}</p>
            <p className="stat-subtext">customer questions</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <p className="stat-label">Conversations</p>
            <p className="stat-value">{summary.overview.uniqueConversations.toLocaleString()}</p>
            <p className="stat-subtext">
              Avg {summary.overview.avgMessagesPerConversation.toFixed(1)} msgs each
            </p>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <p className="stat-label">Cache Hit Rate</p>
            <p className="stat-value">
              {(summary.overview.cacheHitRate * 100).toFixed(1)}%
            </p>
            <p className="stat-subtext">instant responses</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <p className="stat-label">Cost Savings</p>
            <p className="stat-value">
              ${summary.cachePerformance.savings.estimatedDollarsSaved.toFixed(2)}
            </p>
            <p className="stat-subtext">
              {summary.cachePerformance.savings.tokensSaved.toLocaleString()} tokens saved
            </p>
          </div>
        </div>
      </div>

      {/* Popular Queries Section */}
      <div className="analytics-section">
        <h3>🔥 Most Asked Questions</h3>
        {summary.popularQueries.length > 0 ? (
          <div className="popular-queries-list">
            {summary.popularQueries.map((q, index) => (
              <div key={index} className="popular-query-item">
                <div className="query-rank">#{index + 1}</div>
                <div className="query-content">
                  <p className="query-text">{q.query}</p>
                  <div className="query-meta">
                    <span className="query-category">
                      {getCategoryIcon(q.category)} {getCategoryLabel(q.category)}
                    </span>
                    {q.topics.length > 0 && (
                      <span className="query-topics">
                        {q.topics.slice(0, 3).map((topic, i) => (
                          <span key={i} className="topic-tag">{topic}</span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="query-count">
                  <span className="count-number">{q.count}</span>
                  <span className="count-label">times</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No queries yet. Start conversations with your customers!</p>
          </div>
        )}
      </div>

      {/* Category Breakdown Section */}
      <div className="analytics-section">
        <h3>📊 Query Categories</h3>
        {summary.categoryBreakdown.length > 0 ? (
          <div className="category-breakdown">
            {summary.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="category-item">
                <div className="category-header" onClick={() =>
                  setExpandedCategory(expandedCategory === cat.category ? null : cat.category)
                }>
                  <div className="category-info">
                    <span className="category-icon">{getCategoryIcon(cat.category)}</span>
                    <span className="category-name">{getCategoryLabel(cat.category)}</span>
                    <span className="category-count">({cat.count} queries)</span>
                  </div>
                  <div className="category-percentage">
                    {cat.percentage.toFixed(1)}%
                  </div>
                </div>

                <div className="category-progress">
                  <div
                    className="category-progress-bar"
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>

                {expandedCategory === cat.category && cat.topQueries.length > 0 && (
                  <div className="category-top-queries">
                    <p className="top-queries-title">Top questions in this category:</p>
                    <ul>
                      {cat.topQueries.map((q, i) => (
                        <li key={i}>
                          {q.query} <span className="mini-count">({q.count})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No category data available yet.</p>
          </div>
        )}
      </div>

      {/* Cache Performance Section */}
      <div className="analytics-section cache-performance">
        <h3>⚡ Intelligent Caching Performance</h3>
        <div className="cache-stats-grid">
          <div className="cache-stat">
            <p className="cache-stat-label">Cache Hit Rate</p>
            <p className="cache-stat-value">
              {(summary.cachePerformance.hitRate * 100).toFixed(1)}%
            </p>
            <p className="cache-stat-desc">
              Queries answered instantly from cache
            </p>
          </div>

          <div className="cache-stat">
            <p className="cache-stat-label">Cached Responses</p>
            <p className="cache-stat-value">
              {summary.cachePerformance.totalCached}
            </p>
            <p className="cache-stat-desc">
              Unique responses stored for reuse
            </p>
          </div>

          <div className="cache-stat">
            <p className="cache-stat-label">Tokens Saved</p>
            <p className="cache-stat-value">
              {summary.cachePerformance.savings.tokensSaved.toLocaleString()}
            </p>
            <p className="cache-stat-desc">
              AI API calls avoided
            </p>
          </div>

          <div className="cache-stat highlight">
            <p className="cache-stat-label">💰 Money Saved</p>
            <p className="cache-stat-value">
              ${summary.cachePerformance.savings.estimatedDollarsSaved.toFixed(2)}
            </p>
            <p className="cache-stat-desc">
              Cost reduction from caching
            </p>
          </div>
        </div>

        <div className="cache-info">
          <p>
            ℹ️ Intelligent caching automatically stores responses to similar queries,
            reducing AI costs and providing instant answers to customers.
          </p>
        </div>
      </div>
    </div>
  );
}
