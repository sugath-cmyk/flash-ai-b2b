(function() {
  'use strict';

  console.log('Flash AI: Widget script loaded!');
  console.log('Flash AI: Config available:', window.flashAIConfig);

  // Get store ID from config
  const storeId = window.flashAIConfig?.storeId;
  if (!storeId) {
    console.error('Flash AI: Store ID not configured in window.flashAIConfig');
    console.error('Flash AI: window.flashAIConfig =', window.flashAIConfig);
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
  let conversationId = null;
  let config = {};

  // Find the best location to inject the widget (below quantity/add to cart)
  function findInsertionPoint() {
    console.log('Flash AI: Finding insertion point...');

    // Try multiple selectors to find the product form
    const selectors = [
      'input[type="number"][name*="quantity"]',
      'input[name="quantity"]',
      '.quantity',
      '.product-form__quantity',
      'form[action*="/cart/add"]',
      '.product-form',
      '.product-info',
      '.product__info-container',
      'button[name="add"]',
      '.product-single',
      '[data-product-form]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Flash AI: Found element with selector:', selector);
        // Find the parent container to insert after
        let container = element;
        // Go up a few levels to find a good container
        for (let i = 0; i < 3; i++) {
          if (container.parentElement) {
            container = container.parentElement;
          }
        }
        console.log('Flash AI: Using container:', container);
        return container;
      }
    }

    console.log('Flash AI: No specific selector found, using fallback');
    // Fallback: insert at the end of main content
    return document.querySelector('main') || document.body;
  }

  // Create inline chat widget
  function createInlineChatWidget() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'flash-ai-widget';
    widgetContainer.style.cssText = `
      margin: 30px 0;
      width: 100%;
      max-width: 600px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px 12px 0 0;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    header.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
      </svg>
      <div style="flex: 1;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Ask anything</h3>
        <p style="margin: 2px 0 0 0; font-size: 10px; opacity: 0.7;">powered by Flash AI</p>
      </div>
    `;

    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'flash-ai-messages';
    messagesContainer.style.cssText = `
      min-height: 300px;
      max-height: 450px;
      overflow-y: auto;
      padding: 20px;
      background: #f7f7f7;
      border-left: 1px solid #e0e0e0;
      border-right: 1px solid #e0e0e0;
    `;

    // Add welcome message
    addMessage(config.welcomeMessage || 'Ask anything about product', 'bot');

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 15px 20px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 0 0 12px 12px;
      display: flex;
      gap: 10px;
      align-items: center;
    `;
    inputContainer.innerHTML = `
      <input
        type="text"
        id="flash-ai-input"
        placeholder="Type your message..."
        style="flex: 1; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit;"
      />
      <button
        id="flash-ai-send"
        style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s; font-size: 14px;"
      >Send</button>
    `;

    widgetContainer.appendChild(header);
    widgetContainer.appendChild(messagesContainer);
    widgetContainer.appendChild(inputContainer);

    // Event listeners
    const sendButton = inputContainer.querySelector('#flash-ai-send');
    const input = inputContainer.querySelector('#flash-ai-input');

    sendButton.onclick = sendMessage;
    input.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };

    // Hover effect for send button
    sendButton.onmouseenter = () => {
      sendButton.style.opacity = '0.9';
    };
    sendButton.onmouseleave = () => {
      sendButton.style.opacity = '1';
    };

    return widgetContainer;
  }

  // Add message to chat
  function addMessage(text, sender) {
    const messagesContainer = document.getElementById('flash-ai-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      margin-bottom: 15px;
      display: flex;
      ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
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
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    const messagesContainer = document.getElementById('flash-ai-messages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'flash-ai-typing';
    typingDiv.style.cssText = `
      margin-bottom: 15px;
      font-size: 14px;
      color: #666;
      font-style: italic;
    `;
    typingDiv.textContent = 'Typing...';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

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
    console.log('Flash AI: Initializing widget...');
    console.log('Flash AI: Store ID:', storeId);
    console.log('Flash AI: Current URL:', window.location.href);

    await loadConfig();
    console.log('Flash AI: Config loaded:', config);

    // Find where to insert the widget
    const insertionPoint = findInsertionPoint();

    if (!insertionPoint) {
      console.error('Flash AI: Could not find suitable insertion point');
      return;
    }

    console.log('Flash AI: Creating widget...');
    // Create and insert the widget
    const widget = createInlineChatWidget();

    // Insert after the found element
    if (insertionPoint.nextSibling) {
      insertionPoint.parentNode.insertBefore(widget, insertionPoint.nextSibling);
      console.log('Flash AI: Widget inserted before next sibling');
    } else {
      insertionPoint.parentNode.appendChild(widget);
      console.log('Flash AI: Widget appended to parent');
    }

    console.log('Flash AI: Widget successfully inserted into page!');

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
      console.log('Flash AI: Widget load tracked successfully');
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
