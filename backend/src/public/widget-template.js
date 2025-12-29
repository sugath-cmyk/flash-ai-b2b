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
  let isFloatingOpen = false;
  let conversationId = null;
  let config = {};

  // Detect if we're on a product page
  function isProductPage() {
    // Check URL patterns
    if (window.location.pathname.includes('/products/')) return true;
    // Check for product-specific elements
    const productIndicators = [
      'form[action*="/cart/add"]',
      '.product-form',
      '[data-product-form]',
      '.product-single',
      'input[name="id"][type="hidden"]' // Shopify product variant input
    ];
    return productIndicators.some(selector => document.querySelector(selector));
  }

  // Find insertion point for inline widget on product pages
  function findInsertionPoint() {
    console.log('Flash AI: Finding insertion point for inline widget...');

    const selectors = [
      'form[action*="/cart/add"]',
      '.product-form',
      '[data-product-form]',
      'button[name="add"]',
      '.product-single',
      '.product-info',
      '.product__info-container',
      'input[type="number"][name*="quantity"]',
      'input[name="quantity"]',
      '.quantity'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Flash AI: Found element with selector:', selector);
        return element;
      }
    }

    console.log('Flash AI: No specific selector found for inline widget');
    return null;
  }

  // Create floating chat button
  function createFloatingButton() {
    const container = document.createElement('div');
    container.id = 'flash-ai-floating-container';
    container.style.cssText = `
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    const button = document.createElement('button');
    button.id = 'flash-ai-floating-button';
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
    button.onclick = toggleFloatingChat;

    container.appendChild(button);
    return container;
  }

  // Create floating chat window
  function createFloatingChatWindow() {
    const chatWindow = document.createElement('div');
    chatWindow.id = 'flash-ai-floating-window';
    chatWindow.style.cssText = `
      display: none;
      position: fixed;
      right: 90px;
      top: 50%;
      transform: translateY(-50%);
      width: 380px;
      height: 600px;
      max-height: 90vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Ask anything</h3>
        <p style="margin: 2px 0 0 0; font-size: 10px; opacity: 0.7;">powered by Flash AI</p>
      </div>
      <button id="flash-ai-floating-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 24px; padding: 0; width: 30px; height: 30px;">&times;</button>
    `;

    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'flash-ai-floating-messages';
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
        id="flash-ai-floating-input"
        placeholder="Type your message..."
        style="flex: 1; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none;"
      />
      <button
        id="flash-ai-floating-send"
        style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;"
      >Send</button>
    `;

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputContainer);

    // Event listeners
    setTimeout(() => {
      const closeBtn = document.getElementById('flash-ai-floating-close');
      const sendBtn = document.getElementById('flash-ai-floating-send');
      const input = document.getElementById('flash-ai-floating-input');

      if (closeBtn) closeBtn.onclick = toggleFloatingChat;
      if (sendBtn) sendBtn.onclick = () => sendMessage('floating');
      if (input) input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage('floating'); };
    }, 0);

    return chatWindow;
  }

  // Create inline widget for product pages
  function createInlineWidget() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'flash-ai-inline-widget';
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
    messagesContainer.id = 'flash-ai-inline-messages';
    messagesContainer.style.cssText = `
      min-height: 300px;
      max-height: 450px;
      overflow-y: auto;
      padding: 20px;
      background: #f7f7f7;
      border-left: 1px solid #e0e0e0;
      border-right: 1px solid #e0e0e0;
    `;

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
        id="flash-ai-inline-input"
        placeholder="Ask anything about product..."
        style="flex: 1; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit;"
      />
      <button
        id="flash-ai-inline-send"
        style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s; font-size: 14px;"
      >Send</button>
    `;

    widgetContainer.appendChild(header);
    widgetContainer.appendChild(messagesContainer);
    widgetContainer.appendChild(inputContainer);

    // Event listeners
    setTimeout(() => {
      const sendBtn = document.getElementById('flash-ai-inline-send');
      const input = document.getElementById('flash-ai-inline-input');

      if (sendBtn) sendBtn.onclick = () => sendMessage('inline');
      if (input) input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage('inline'); };
    }, 0);

    // Add welcome message
    addMessage('Ask anything about product', 'bot', 'inline');

    return widgetContainer;
  }

  // Toggle floating chat
  function toggleFloatingChat() {
    isFloatingOpen = !isFloatingOpen;
    const chatWindow = document.getElementById('flash-ai-floating-window');
    const chatButton = document.getElementById('flash-ai-floating-button');

    if (isFloatingOpen) {
      chatWindow.style.display = 'flex';
      chatButton.style.display = 'none';

      // Show welcome message if first time
      const messagesContainer = document.getElementById('flash-ai-floating-messages');
      if (messagesContainer && messagesContainer.children.length === 0) {
        addMessage('Hello! How can I help you today?', 'bot', 'floating');
      }
    } else {
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';
    }
  }

  // Add message to chat
  function addMessage(text, sender, type) {
    const containerId = type === 'floating' ? 'flash-ai-floating-messages' : 'flash-ai-inline-messages';
    const messagesContainer = document.getElementById(containerId);
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
  async function sendMessage(type) {
    const inputId = type === 'floating' ? 'flash-ai-floating-input' : 'flash-ai-inline-input';
    const containerId = type === 'floating' ? 'flash-ai-floating-messages' : 'flash-ai-inline-messages';

    const input = document.getElementById(inputId);
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user', type);
    input.value = '';

    // Show typing indicator
    const messagesContainer = document.getElementById(containerId);
    const typingDiv = document.createElement('div');
    typingDiv.id = `flash-ai-typing-${type}`;
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
      const typing = document.getElementById(`flash-ai-typing-${type}`);
      if (typing) typing.remove();

      if (data.success) {
        conversationId = data.data.conversationId;
        addMessage(data.data.response, 'bot', type);
      } else {
        addMessage('Sorry, something went wrong. Please try again.', 'bot', type);
      }
    } catch (error) {
      console.error('Flash AI: Error sending message', error);
      const typing = document.getElementById(`flash-ai-typing-${type}`);
      if (typing) typing.remove();
      addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot', type);
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

    // Always show floating button (site-wide)
    console.log('Flash AI: Creating floating button...');
    const floatingButton = createFloatingButton();
    const floatingWindow = createFloatingChatWindow();
    document.body.appendChild(floatingButton);
    document.body.appendChild(floatingWindow);
    console.log('Flash AI: Floating widget added!');

    // Add inline widget on product pages
    if (isProductPage()) {
      console.log('Flash AI: Product page detected, adding inline widget...');
      const insertionPoint = findInsertionPoint();

      if (insertionPoint) {
        const inlineWidget = createInlineWidget();

        // Insert after the found element
        if (insertionPoint.nextSibling) {
          insertionPoint.parentNode.insertBefore(inlineWidget, insertionPoint.nextSibling);
        } else {
          insertionPoint.parentNode.appendChild(inlineWidget);
        }
        console.log('Flash AI: Inline widget added to product page!');
      } else {
        console.log('Flash AI: Could not find insertion point for inline widget');
      }
    } else {
      console.log('Flash AI: Not a product page, skipping inline widget');
    }

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
            referrer: document.referrer,
            isProductPage: isProductPage()
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
