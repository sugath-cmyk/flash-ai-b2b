/**
 * Flash AI Chat Widget
 * Embeddable chat widget for e-commerce stores
 */

(function() {
  'use strict';

  // Configuration
  const config = window.flashAIConfig || {};
  const API_URL = config.apiUrl || 'http://localhost:3000/api/widget';
  const API_KEY = config.apiKey;
  const STORE_ID = config.storeId;

  if (!API_KEY || !STORE_ID) {
    console.error('Flash AI Widget: Missing API key or store ID');
    return;
  }

  // Generate session ID
  function generateSessionId() {
    const stored = sessionStorage.getItem('flashai_session_id');
    if (stored) return stored;

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('flashai_session_id', sessionId);
    return sessionId;
  }

  // Generate visitor ID
  function generateVisitorId() {
    const stored = localStorage.getItem('flashai_visitor_id');
    if (stored) return stored;

    const visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('flashai_visitor_id', visitorId);
    return visitorId;
  }

  const sessionId = generateSessionId();
  const visitorId = generateVisitorId();
  let conversationId = null;
  let isOpen = false;
  let widgetConfig = null;

  // Fetch widget configuration
  async function fetchConfig() {
    try {
      const response = await fetch(`${API_URL}/config`, {
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch config');

      const data = await response.json();
      widgetConfig = data.data;
      return widgetConfig;
    } catch (error) {
      console.error('Flash AI Widget: Config error:', error);
      return null;
    }
  }

  // Track analytics event
  async function trackEvent(eventType, eventData = {}) {
    try {
      await fetch(`${API_URL}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          eventType,
          eventData,
          sessionInfo: {
            sessionId,
            visitorId,
            pageUrl: window.location.href,
            referrer: document.referrer,
            deviceType: /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop',
            browser: navigator.userAgent,
          },
        }),
      });
    } catch (error) {
      console.error('Flash AI Widget: Analytics error:', error);
    }
  }

  // Send chat message
  async function sendMessage(message) {
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          sessionId,
          visitorId,
          message,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send message');
      }

      const data = await response.json();
      conversationId = data.data.conversationId;

      trackEvent('message_sent', { message: message.substring(0, 100) });

      return data.data.message;
    } catch (error) {
      console.error('Flash AI Widget: Chat error:', error);
      throw error;
    }
  }

  // Create widget HTML
  function createWidget() {
    const primaryColor = widgetConfig?.primary_color || '#3B82F6';
    const position = widgetConfig?.position || 'bottom-right';
    const greetingMessage = widgetConfig?.greeting_message || 'Hi! How can I help you today?';
    const placeholderText = widgetConfig?.placeholder_text || 'Ask me anything...';

    const positionStyles = {
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
    };

    const widgetHTML = `
      <div id="flashai-widget-container" style="position: fixed; ${positionStyles[position]} z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Chat Button -->
        <button id="flashai-chat-button" style="
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${primaryColor};
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-center;
          transition: transform 0.2s;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>

        <!-- Chat Window -->
        <div id="flashai-chat-window" style="
          display: none;
          width: 380px;
          height: 600px;
          max-height: 90vh;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          flex-direction: column;
          overflow: hidden;
          margin-bottom: 20px;
        ">
          <!-- Header -->
          <div style="
            background: ${primaryColor};
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div>
              <div style="font-weight: 600; font-size: 18px;">AI Assistant</div>
              <div style="font-size: 12px; opacity: 0.9;">Powered by Flash AI</div>
            </div>
            <button id="flashai-close-button" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 24px;
              padding: 0;
              width: 24px;
              height: 24px;
            ">×</button>
          </div>

          <!-- Messages -->
          <div id="flashai-messages" style="
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f9fafb;
          ">
            <div style="
              background: white;
              padding: 12px 16px;
              border-radius: 12px;
              margin-bottom: 12px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            ">
              ${greetingMessage}
            </div>
          </div>

          <!-- Input -->
          <div style="
            padding: 16px;
            background: white;
            border-top: 1px solid #e5e7eb;
          ">
            <form id="flashai-chat-form" style="display: flex; gap: 8px;">
              <input
                id="flashai-message-input"
                type="text"
                placeholder="${placeholderText}"
                style="
                  flex: 1;
                  padding: 12px;
                  border: 1px solid #e5e7eb;
                  border-radius: 8px;
                  font-size: 14px;
                  outline: none;
                "
                required
              />
              <button type="submit" style="
                background: ${primaryColor};
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
                white-space: nowrap;
              ">Send</button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    attachEventListeners();
  }

  // Add message to chat
  function addMessage(text, isUser = false) {
    const messagesContainer = document.getElementById('flashai-messages');
    const messageDiv = document.createElement('div');

    messageDiv.style.cssText = `
      background: ${isUser ? widgetConfig?.primary_color || '#3B82F6' : 'white'};
      color: ${isUser ? 'white' : '#1f2937'};
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 12px;
      max-width: 80%;
      ${isUser ? 'margin-left: auto;' : ''}
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      word-wrap: break-word;
    `;

    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Attach event listeners
  function attachEventListeners() {
    const chatButton = document.getElementById('flashai-chat-button');
    const chatWindow = document.getElementById('flashai-chat-window');
    const closeButton = document.getElementById('flashai-close-button');
    const chatForm = document.getElementById('flashai-chat-form');
    const messageInput = document.getElementById('flashai-message-input');

    chatButton.addEventListener('click', () => {
      if (isOpen) {
        chatWindow.style.display = 'none';
        chatButton.style.display = 'flex';
        isOpen = false;
      } else {
        chatWindow.style.display = 'flex';
        chatButton.style.display = 'none';
        isOpen = true;
        trackEvent('widget_opened');
        messageInput.focus();
      }
    });

    chatButton.addEventListener('mouseenter', () => {
      chatButton.style.transform = 'scale(1.1)';
    });

    chatButton.addEventListener('mouseleave', () => {
      chatButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';
      isOpen = false;
    });

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const message = messageInput.value.trim();
      if (!message) return;

      // Add user message
      addMessage(message, true);
      messageInput.value = '';

      // Show typing indicator
      const typingDiv = document.createElement('div');
      typingDiv.id = 'flashai-typing';
      typingDiv.style.cssText = `
        background: white;
        padding: 12px 16px;
        border-radius: 12px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      `;
      typingDiv.textContent = 'Typing...';
      document.getElementById('flashai-messages').appendChild(typingDiv);

      try {
        const response = await sendMessage(message);

        // Remove typing indicator
        document.getElementById('flashai-typing')?.remove();

        // Add AI response
        addMessage(response, false);
      } catch (error) {
        console.error('Flash AI Widget: Chat error:', error);
        document.getElementById('flashai-typing')?.remove();
        const errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
        addMessage(errorMessage, false);
      }
    });
  }

  // Initialize widget
  async function init() {
    await fetchConfig();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createWidget);
    } else {
      createWidget();
    }

    trackEvent('widget_loaded');
  }

  // Start
  init();
})();
