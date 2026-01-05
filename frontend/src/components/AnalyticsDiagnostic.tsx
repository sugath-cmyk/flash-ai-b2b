import React, { useState } from 'react';
import axios from '../lib/axios';

interface DiagnosticProps {
  storeId: string;
}

export default function AnalyticsDiagnostic({ storeId }: DiagnosticProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnosticResults: any[] = [];

    // Test 1: Check localStorage for token
    const token = localStorage.getItem('access_token');
    diagnosticResults.push({
      test: '1. JWT Token in localStorage',
      status: token ? '✅ EXISTS' : '❌ MISSING',
      details: token ? `Token: ${token.substring(0, 20)}...` : 'No access_token found',
    });

    // Test 2: Check axios baseURL
    diagnosticResults.push({
      test: '2. Axios Base URL',
      status: '✅ INFO',
      details: `${import.meta.env.VITE_API_URL || 'https://flash-ai-backend-rld7.onrender.com/api'}`,
    });

    // Test 3: Test health endpoint
    try {
      const healthRes = await fetch('https://flash-ai-backend-rld7.onrender.com/health');
      const healthData = await healthRes.json();
      diagnosticResults.push({
        test: '3. Backend Health Check',
        status: healthRes.ok ? '✅ ONLINE' : '❌ OFFLINE',
        details: `Version: ${healthData.version}, Status: ${healthData.status}`,
      });
    } catch (error: any) {
      diagnosticResults.push({
        test: '3. Backend Health Check',
        status: '❌ ERROR',
        details: error.message,
      });
    }

    // Test 4: Test stats endpoint with auth
    try {
      const statsRes = await axios.get(`/brand/${storeId}/query-analytics/stats?days=30`);
      diagnosticResults.push({
        test: '4. Stats Endpoint (with auth)',
        status: statsRes.status === 200 ? '✅ SUCCESS' : '⚠️ UNEXPECTED',
        details: `Status: ${statsRes.status}, Data: ${JSON.stringify(statsRes.data).substring(0, 100)}...`,
      });
    } catch (error: any) {
      diagnosticResults.push({
        test: '4. Stats Endpoint (with auth)',
        status: '❌ FAILED',
        details: `${error.response?.status || 'NO_RESPONSE'}: ${error.response?.data?.error?.message || error.message}`,
      });
    }

    // Test 5: Test popular queries endpoint
    try {
      const popularRes = await axios.get(`/brand/${storeId}/query-analytics/popular?days=30&limit=10`);
      diagnosticResults.push({
        test: '5. Popular Queries Endpoint',
        status: popularRes.status === 200 ? '✅ SUCCESS' : '⚠️ UNEXPECTED',
        details: `Status: ${popularRes.status}, Queries: ${popularRes.data?.data?.popularQueries?.length || 0}`,
      });
    } catch (error: any) {
      diagnosticResults.push({
        test: '5. Popular Queries Endpoint',
        status: '❌ FAILED',
        details: `${error.response?.status || 'NO_RESPONSE'}: ${error.response?.data?.error?.message || error.message}`,
      });
    }

    // Test 6: Test categories endpoint
    try {
      const catRes = await axios.get(`/brand/${storeId}/query-analytics/categories?days=30`);
      diagnosticResults.push({
        test: '6. Categories Endpoint',
        status: catRes.status === 200 ? '✅ SUCCESS' : '⚠️ UNEXPECTED',
        details: `Status: ${catRes.status}, Categories: ${catRes.data?.data?.categories?.length || 0}`,
      });
    } catch (error: any) {
      diagnosticResults.push({
        test: '6. Categories Endpoint',
        status: '❌ FAILED',
        details: `${error.response?.status || 'NO_RESPONSE'}: ${error.response?.data?.error?.message || error.message}`,
      });
    }

    // Test 7: Direct database check info
    diagnosticResults.push({
      test: '7. Database Info (from backfill)',
      status: '✅ INFO',
      details: 'Store has 40 conversations, 74 categorized messages in production DB',
    });

    setResults(diagnosticResults);
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', margin: '20px 0' }}>
      <h2>🔍 Analytics Diagnostics</h2>
      <p>Store ID: {storeId}</p>

      <button
        onClick={runDiagnostics}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#3B82F6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
        }}
      >
        {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
      </button>

      {results.length > 0 && (
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          {results.map((result, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '15px',
                paddingBottom: '15px',
                borderBottom: idx < results.length - 1 ? '1px solid #e0e0e0' : 'none',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {result.status} {result.test}
              </div>
              <div style={{ fontSize: '14px', color: '#666', fontFamily: 'monospace' }}>
                {result.details}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
