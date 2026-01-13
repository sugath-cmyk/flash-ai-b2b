import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../lib/axios';

interface WidgetSettings {
  // Chatbot Widget
  chatbot_enabled: boolean;
  chatbot_mode: 'floating' | 'inline' | 'both';
  chatbot_position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  chatbot_button_text: string;
  chatbot_primary_color: string;
  chatbot_welcome_message: string;
  chatbot_avatar_url?: string;
  chatbot_tone: 'friendly' | 'professional' | 'casual';

  // VTO Widget
  vto_enabled: boolean;
  vto_mode: 'floating' | 'inline' | 'both';
  vto_position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  vto_button_text: string;
  vto_primary_color: string;

  // Global Settings
  widget_border_radius: number;
  widget_shadow: boolean;
  widget_animation: boolean;
  widget_z_index: number;
}

const WidgetManagement: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<WidgetSettings>({
    chatbot_enabled: true,
    chatbot_mode: 'floating',
    chatbot_position: 'bottom-right',
    chatbot_button_text: 'Chat with AI',
    chatbot_primary_color: '#10b981',
    chatbot_welcome_message: 'Hi! How can I help you today?',
    chatbot_tone: 'friendly',
    vto_enabled: false,
    vto_mode: 'floating',
    vto_position: 'bottom-left',
    vto_button_text: 'Try On',
    vto_primary_color: '#000000',
    widget_border_radius: 8,
    widget_shadow: true,
    widget_animation: true,
    widget_z_index: 999999,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [storeId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/brand/${storeId}/widget/settings`);
      if (response.data.data) {
        setSettings(prev => ({ ...prev, ...response.data.data }));
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      if (err.response?.status !== 404) {
        setError('Failed to load widget settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await axios.put(`/brand/${storeId}/widget/settings`, settings);

      setSuccess('Widget settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleWidget = async (widgetType: 'chatbot' | 'vto', enabled: boolean) => {
    try {
      await axios.post(`/brand/${storeId}/widget/toggle`, { widgetType, enabled });
      setSettings(prev => ({
        ...prev,
        [`${widgetType}_enabled`]: enabled
      }));
      setSuccess(`${widgetType === 'chatbot' ? 'Chatbot' : 'VTO'} widget ${enabled ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle widget');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-emerald-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading widget settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate(`/brand/${storeId}`)}
                className="text-sm text-gray-600 hover:text-gray-900 mb-1 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Widget Management</h1>
              <p className="text-sm text-gray-600">Manage your chatbot and virtual try-on widgets</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-800 font-medium">{success}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800 font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Chatbot Widget Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">AI Chatbot Widget</h2>
                <p className="text-sm text-gray-600">Interactive chat assistant for customer support</p>
              </div>
            </div>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.chatbot_enabled}
                  onChange={(e) => toggleWidget('chatbot', e.target.checked)}
                />
                <div className={`w-14 h-8 rounded-full transition ${settings.chatbot_enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition transform ${settings.chatbot_enabled ? 'translate-x-6' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900">
                {settings.chatbot_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {settings.chatbot_enabled && (
            <div className="space-y-4 pl-16">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Mode</label>
                  <select
                    value={settings.chatbot_mode}
                    onChange={(e) => setSettings(prev => ({ ...prev, chatbot_mode: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="floating">Floating Button</option>
                    <option value="inline">Inline Widget</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <select
                    value={settings.chatbot_position}
                    onChange={(e) => setSettings(prev => ({ ...prev, chatbot_position: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={settings.chatbot_button_text}
                    onChange={(e) => setSettings(prev => ({ ...prev, chatbot_button_text: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.chatbot_primary_color}
                      onChange={(e) => setSettings(prev => ({ ...prev, chatbot_primary_color: e.target.value }))}
                      className="h-10 w-20 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={settings.chatbot_primary_color}
                      onChange={(e) => setSettings(prev => ({ ...prev, chatbot_primary_color: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                <textarea
                  value={settings.chatbot_welcome_message}
                  onChange={(e) => setSettings(prev => ({ ...prev, chatbot_welcome_message: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                <div className="flex gap-2">
                  {['friendly', 'professional', 'casual'].map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setSettings(prev => ({ ...prev, chatbot_tone: tone as any }))}
                      className={`px-4 py-2 rounded-lg border ${
                        settings.chatbot_tone === tone
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate(`/brand/${storeId}/widget-customization`)}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  Advanced Chatbot Settings →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* VTO Widget Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Virtual Try-On Widget</h2>
                <p className="text-sm text-gray-600">AI-powered body scanning and virtual fitting</p>
              </div>
            </div>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.vto_enabled}
                  onChange={(e) => toggleWidget('vto', e.target.checked)}
                />
                <div className={`w-14 h-8 rounded-full transition ${settings.vto_enabled ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition transform ${settings.vto_enabled ? 'translate-x-6' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900">
                {settings.vto_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {settings.vto_enabled && (
            <div className="space-y-4 pl-16">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Mode</label>
                  <select
                    value={settings.vto_mode}
                    onChange={(e) => setSettings(prev => ({ ...prev, vto_mode: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="floating">Floating Button</option>
                    <option value="inline">Inline Widget</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <select
                    value={settings.vto_position}
                    onChange={(e) => setSettings(prev => ({ ...prev, vto_position: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={settings.vto_button_text}
                    onChange={(e) => setSettings(prev => ({ ...prev, vto_button_text: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.vto_primary_color}
                      onChange={(e) => setSettings(prev => ({ ...prev, vto_primary_color: e.target.value }))}
                      className="h-10 w-20 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={settings.vto_primary_color}
                      onChange={(e) => setSettings(prev => ({ ...prev, vto_primary_color: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-purple-900">ML Service Required</p>
                    <p className="text-sm text-purple-700 mt-1">
                      The VTO widget requires the ML inference service to be running for body scanning and 3D rendering.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Widget Settings */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Widget Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Border Radius (px)</label>
              <input
                type="number"
                value={settings.widget_border_radius}
                onChange={(e) => setSettings(prev => ({ ...prev, widget_border_radius: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                min="0"
                max="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Z-Index</label>
              <input
                type="number"
                value={settings.widget_z_index}
                onChange={(e) => setSettings(prev => ({ ...prev, widget_z_index: parseInt(e.target.value) || 999999 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.widget_shadow}
                onChange={(e) => setSettings(prev => ({ ...prev, widget_shadow: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">Enable Shadow</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.widget_animation}
                onChange={(e) => setSettings(prev => ({ ...prev, widget_animation: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">Enable Animations</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetManagement;
