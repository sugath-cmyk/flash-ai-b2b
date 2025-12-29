(function() {
  'use strict';

  // Get store ID from config
  const storeId = window.flashAIConfig?.storeId;
  if (!storeId) {
    console.error('Flash AI: Store ID not configured');
    return;
  }

  const API_BASE_URL = '{{API_BASE_URL}}';
  const API_KEY = '{{API_KEY}}';

  // Generate unique IDs
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get or create visitor ID
  function getVisitorId() {
    let visitorId = localStorage.getItem('flash_ai_visitor_id');
    if (!visitorId) {
      visitorId = generateId();
      localStorage.setItem('flash_ai_visitor_id', visitorId);
    }
    return visitorId;
  }

  // Get or create session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem('flash_ai_session_id');
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem('flash_ai_session_id', sessionId);
    }
    return sessionId;
  }

  // Widget state
  let isOpen = false;
  let conversationId = null;
  let config = {};

  // Create widget container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'flash-ai-widget';
  widgetContainer.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  `;
  document.body.appendChild(widgetContainer);

  // Create chat button
  function createChatButton() {
    const button = document.createElement('button');
    button.id = 'flash-ai-chat-button';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
      </svg>
    `;
    button.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    `;
    button.onmouseenter = () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    };
    button.onclick = toggleChat;
    return button;
  }

  // Create chat window
  function createChatWindow() {
    const chatWindow = document.createElement('div');
    chatWindow.id = 'flash-ai-chat-window';
    chatWindow.style.cssText = `
      display: none;
      position: fixed;
      bottom: 180px;
      right: 20px;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 200px);
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${config.title || 'Chat with us'}</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${config.subtitle || 'We typically reply in minutes'}</p>
      </div>
      <button id="flash-ai-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 24px; padding: 0; width: 30px; height: 30px;">&times;</button>
    `;

    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'flash-ai-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #f7f7f7;
    `;

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 15px;
      background: white;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 10px;
    `;
    inputContainer.innerHTML = `
      <input
        type="text"
        id="flash-ai-input"
        placeholder="Type your message..."
        style="flex: 1; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none;"
      />
      <button
        id="flash-ai-send"
        style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;"
      >Send</button>
    `;

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputContainer);

    // Event listeners
    document.getElementById('flash-ai-close').onclick = toggleChat;
    document.getElementById('flash-ai-send').onclick = sendMessage;
    document.getElementById('flash-ai-input').onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };

    return chatWindow;
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('flash-ai-chat-window');
    const chatButton = document.getElementById('flash-ai-chat-button');

    if (isOpen) {
      chatWindow.style.display = 'flex';
      chatButton.style.display = 'none';

      // Show welcome message if first time
      const messagesContainer = document.getElementById('flash-ai-messages');
      if (messagesContainer.children.length === 0) {
        addMessage(config.welcomeMessage || 'Hello! How can I help you today?', 'bot');
      }
    } else {
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';
    }
  }

  // Add message to chat
  function addMessage(text, sender) {
    const messagesContainer = document.getElementById('flash-ai-messages');
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      margin-bottom: 15px;
      display: flex;
      ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      ${sender === 'user'
        ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 4px;'
        : 'background: white; color: #333; border-bottom-left-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'
      }
    `;
    bubble.textContent = text;
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Send message
  async function sendMessage() {
    const input = document.getElementById('flash-ai-input');
    const message = input.value.trim();

    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.id = 'flash-ai-typing';
    typingDiv.style.cssText = 'margin-bottom: 15px; font-size: 14px; color: #666;';
    typingDiv.textContent = 'Typing...';
    document.getElementById('flash-ai-messages').appendChild(typingDiv);

    try {
      const response = await fetch(`${API_BASE_URL}/api/widget/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          sessionId: getSessionId(),
          visitorId: getVisitorId(),
          message: message,
          conversationId: conversationId
        })
      });

      const data = await response.json();

      // Remove typing indicator
      const typing = document.getElementById('flash-ai-typing');
      if (typing) typing.remove();

      if (data.success) {
        conversationId = data.data.conversationId;
        addMessage(data.data.response, 'bot');
      } else {
        addMessage('Sorry, something went wrong. Please try again.', 'bot');
      }
    } catch (error) {
      console.error('Flash AI: Error sending message', error);
      const typing = document.getElementById('flash-ai-typing');
      if (typing) typing.remove();
      addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
    }
  }

  // Load widget configuration
  async function loadConfig() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/widget/config`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });

      const data = await response.json();

      if (data.success) {
        config = data.data;
      }
    } catch (error) {
      console.error('Flash AI: Error loading config', error);
    }
  }

  // Initialize widget
  async function init() {
    await loadConfig();

    const chatButton = createChatButton();
    const chatWindow = createChatWindow();

    widgetContainer.appendChild(chatButton);
    widgetContainer.appendChild(chatWindow);

    // Track widget load
    try {
      await fetch(`${API_BASE_URL}/api/widget/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          eventType: 'widget_loaded',
          eventData: {
            url: window.location.href,
            referrer: document.referrer
          },
          sessionInfo: {
            sessionId: getSessionId(),
            visitorId: getVisitorId()
          }
        })
      });
    } catch (error) {
      console.error('Flash AI: Error tracking event', error);
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
