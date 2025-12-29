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
  let isTopBannerOpen = false;
  let conversationId = null;
  let config = {};

  // Detect if we're on a product page
  function isProductPage() {
    return window.location.pathname.includes('/products/');
  }

  // Find "Buy it now" button to insert widget below it
  function findBuyNowButton() {
    console.log('Flash AI: Looking for Buy it now button...');

    // Try multiple approaches to find the Buy it now button
    const selectors = [
      'button:contains("Buy it now")',
      'button:contains("Buy now")',
      'button:contains("buy")',
      '.shopify-payment-button',
      '[class*="buy-now"]',
      '[class*="buy_now"]',
      '[id*="buy-now"]',
      'button[name="checkout"]'
    ];

    // First try text-based search
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent.toLowerCase().trim();
      if (text.includes('buy it now') || text.includes('buy now')) {
        console.log('Flash AI: Found Buy it now button by text');
        return button;
      }
    }

    // Then try class-based selectors
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          console.log('Flash AI: Found button with selector:', selector);
          return element;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    // Fallback: find "Add to cart" button and use its parent
    const addToCartButtons = document.querySelectorAll('button');
    for (const button of addToCartButtons) {
      const text = button.textContent.toLowerCase().trim();
      if (text.includes('add to cart')) {
        console.log('Flash AI: Found Add to cart button, using as fallback');
        return button.parentElement;
      }
    }

    console.log('Flash AI: Could not find Buy it now button');
    return null;
  }

  // Create top banner chat button
  function createTopBannerButton() {
    const banner = document.createElement('div');
    banner.id = 'flash-ai-top-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      padding: 8px 0;
      width: 100%;
      display: flex;
      justify-content: center;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    const button = document.createElement('button');
    button.id = 'flash-ai-top-button';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
      </svg>
      <span>Ask anything</span>
    `;
    button.style.cssText = `
      padding: 10px 24px;
      border-radius: 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
      pointer-events: auto;
    `;

    button.onmouseenter = () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    };
    button.onclick = toggleTopBanner;

    banner.appendChild(button);
    return banner;
  }

  // Create top banner chat window
  function createTopBannerWindow() {
    const chatWindow = document.createElement('div');
    chatWindow.id = 'flash-ai-top-window';
    chatWindow.style.cssText = `
      display: none;
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 600px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
      <button id="flash-ai-top-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 24px; padding: 0; width: 30px; height: 30px;">&times;</button>
    `;

    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'flash-ai-top-messages';
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
        id="flash-ai-top-input"
        placeholder="Type your message..."
        style="flex: 1; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; outline: none;"
      />
      <button
        id="flash-ai-top-send"
        style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;"
      >Send</button>
    `;

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputContainer);

    // Event listeners
    setTimeout(() => {
      const closeBtn = document.getElementById('flash-ai-top-close');
      const sendBtn = document.getElementById('flash-ai-top-send');
      const input = document.getElementById('flash-ai-top-input');

      if (closeBtn) closeBtn.onclick = toggleTopBanner;
      if (sendBtn) sendBtn.onclick = () => sendMessage('top');
      if (input) input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage('top'); };
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
      min-height: 250px;
      max-height: 400px;
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
        placeholder="Ask anything about this product..."
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

  // Toggle top banner
  function toggleTopBanner() {
    isTopBannerOpen = !isTopBannerOpen;
    const chatWindow = document.getElementById('flash-ai-top-window');
    const chatButton = document.getElementById('flash-ai-top-button');

    if (isTopBannerOpen) {
      chatWindow.style.display = 'flex';
      chatButton.style.display = 'none';

      // Show welcome message if first time
      const messagesContainer = document.getElementById('flash-ai-top-messages');
      if (messagesContainer && messagesContainer.children.length === 0) {
        addMessage('Hello! How can I help you today?', 'bot', 'top');
      }
    } else {
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';
    }
  }

  // Add message to chat
  function addMessage(text, sender, type) {
    const containerId = type === 'top' ? 'flash-ai-top-messages' : 'flash-ai-inline-messages';
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
    const inputId = type === 'top' ? 'flash-ai-top-input' : 'flash-ai-inline-input';
    const containerId = type === 'top' ? 'flash-ai-top-messages' : 'flash-ai-inline-messages';

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

    // Always show top banner (site-wide)
    console.log('Flash AI: Creating top banner...');
    const topBanner = createTopBannerButton();
    const topWindow = createTopBannerWindow();
    document.body.appendChild(topBanner);
    document.body.appendChild(topWindow);
    console.log('Flash AI: Top banner added!');

    // Add inline widget on product pages (below Buy it now button)
    if (isProductPage()) {
      console.log('Flash AI: Product page detected, adding inline widget...');

      // Wait a bit for page to fully load
      setTimeout(() => {
        const buyNowButton = findBuyNowButton();

        if (buyNowButton) {
          const inlineWidget = createInlineWidget();

          // Insert after the Buy it now button or its parent
          if (buyNowButton.nextSibling) {
            buyNowButton.parentNode.insertBefore(inlineWidget, buyNowButton.nextSibling);
          } else {
            buyNowButton.parentNode.appendChild(inlineWidget);
          }
          console.log('Flash AI: Inline widget added below Buy it now button!');
        } else {
          console.log('Flash AI: Could not find Buy it now button for inline widget');
        }
      }, 1000); // Wait 1 second for dynamic content to load
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
