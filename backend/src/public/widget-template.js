(function() {
  'use strict';

  console.log('Flash AI: Widget initializing...');

  const storeId = window.flashAIConfig?.storeId;
  if (!storeId) {
    console.error('Flash AI: Store ID not configured');
    return;
  }

  const API_BASE_URL = '{{API_BASE_URL}}';
  const API_KEY = '{{API_KEY}}';

  console.log('Flash AI: Config loaded - Store ID:', storeId);

  // Generate unique IDs
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getVisitorId() {
    let visitorId = localStorage.getItem('flash_ai_visitor_id');
    if (!visitorId) {
      visitorId = generateId();
      localStorage.setItem('flash_ai_visitor_id', visitorId);
    }
    return visitorId;
  }

  function getSessionId() {
    let sessionId = sessionStorage.getItem('flash_ai_session_id');
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem('flash_ai_session_id', sessionId);
    }
    return sessionId;
  }

  let isTopOpen = false;
  let conversationId = null;

  // Detect product page
  function isProductPage() {
    return window.location.pathname.includes('/products/');
  }

  // Create top banner button
  function createTopBanner() {
    const banner = document.createElement('div');
    banner.id = 'flash-ai-top-banner';
    banner.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999999;
      pointer-events: none;
    `;

    const button = document.createElement('button');
    button.id = 'flash-ai-button';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="margin-right: 8px;">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
      </svg>
      <span>Ask anything</span>
    `;
    button.style.cssText = `
      padding: 12px 28px;
      border-radius: 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.2s;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    button.onmouseenter = () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
    };
    button.onclick = toggleTopChat;

    banner.appendChild(button);
    return banner;
  }

  // Create top chat window
  function createTopWindow() {
    const window = document.createElement('div');
    window.id = 'flash-ai-window';
    window.style.cssText = `
      display: none;
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 600px;
      height: 500px;
      max-height: 80vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
      z-index: 999999999;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    window.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Ask anything</h3>
          <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.8;">powered by Flash AI</p>
        </div>
        <button id="flash-ai-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 28px; padding: 0; width: 40px; height: 40px; line-height: 1;">&times;</button>
      </div>
      <div id="flash-ai-messages" style="flex: 1; overflow-y: auto; padding: 20px; background: #f5f5f5;"></div>
      <div style="padding: 16px; background: white; border-top: 1px solid #e0e0e0; display: flex; gap: 12px;">
        <input type="text" id="flash-ai-input" placeholder="Type your message..." style="flex: 1; padding: 14px 16px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; outline: none;" />
        <button id="flash-ai-send" style="padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px;">Send</button>
      </div>
    `;

    setTimeout(() => {
      const closeBtn = document.getElementById('flash-ai-close');
      const sendBtn = document.getElementById('flash-ai-send');
      const input = document.getElementById('flash-ai-input');

      if (closeBtn) closeBtn.onclick = toggleTopChat;
      if (sendBtn) sendBtn.onclick = () => sendMessage('top');
      if (input) {
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage('top'); };
      }
    }, 0);

    return window;
  }

  // Create inline widget for product pages
  function createInlineWidget() {
    const widget = document.createElement('div');
    widget.id = 'flash-ai-inline';
    widget.style.cssText = `
      margin: 40px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    widget.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 24px; border-radius: 16px 16px 0 0; display: flex; align-items: center; gap: 12px;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
        </svg>
        <div style="flex: 1;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Ask anything</h3>
          <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.8;">powered by Flash AI</p>
        </div>
      </div>
      <div id="flash-ai-inline-messages" style="min-height: 280px; max-height: 400px; overflow-y: auto; padding: 20px; background: #f5f5f5; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0;"></div>
      <div style="padding: 16px 20px; background: white; border: 1px solid #e0e0e0; border-radius: 0 0 16px 16px; display: flex; gap: 12px;">
        <input type="text" id="flash-ai-inline-input" placeholder="Ask about this product..." style="flex: 1; padding: 14px 18px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; outline: none;" />
        <button id="flash-ai-inline-send" style="padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px;">Send</button>
      </div>
    `;

    setTimeout(() => {
      const sendBtn = document.getElementById('flash-ai-inline-send');
      const input = document.getElementById('flash-ai-inline-input');

      if (sendBtn) sendBtn.onclick = () => sendMessage('inline');
      if (input) {
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage('inline'); };
      }

      addMessage('Ask anything about this product', 'bot', 'inline');
    }, 0);

    return widget;
  }

  function toggleTopChat() {
    isTopOpen = !isTopOpen;
    const window = document.getElementById('flash-ai-window');
    const button = document.getElementById('flash-ai-button');

    if (isTopOpen) {
      window.style.display = 'flex';
      button.style.display = 'none';

      const messages = document.getElementById('flash-ai-messages');
      if (messages && messages.children.length === 0) {
        addMessage('Hello! How can I help you today?', 'bot', 'top');
      }
    } else {
      window.style.display = 'none';
      button.style.display = 'flex';
    }
  }

  function addMessage(text, sender, type) {
    const containerId = type === 'top' ? 'flash-ai-messages' : 'flash-ai-inline-messages';
    const container = document.getElementById(containerId);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      margin-bottom: 16px;
      display: flex;
      ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 75%;
      padding: 12px 18px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      ${sender === 'user'
        ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 4px;'
        : 'background: white; color: #333; border-bottom-left-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'
      }
    `;
    bubble.textContent = text;
    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage(type) {
    const inputId = type === 'top' ? 'flash-ai-input' : 'flash-ai-inline-input';
    const containerId = type === 'top' ? 'flash-ai-messages' : 'flash-ai-inline-messages';

    const input = document.getElementById(inputId);
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user', type);
    input.value = '';

    const container = document.getElementById(containerId);
    const typing = document.createElement('div');
    typing.id = `typing-${type}`;
    typing.style.cssText = 'margin-bottom: 16px; font-size: 14px; color: #666; font-style: italic;';
    typing.textContent = 'Typing...';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

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
      typing.remove();

      if (data.success) {
        conversationId = data.data.conversationId;
        addMessage(data.data.response, 'bot', type);
      } else {
        addMessage('Sorry, something went wrong. Please try again.', 'bot', type);
      }
    } catch (error) {
      console.error('Flash AI: Error:', error);
      typing.remove();
      addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot', type);
    }
  }

  // Initialize
  function init() {
    console.log('Flash AI: Creating widgets...');

    // Always add top banner
    const banner = createTopBanner();
    const window = createTopWindow();
    document.body.appendChild(banner);
    document.body.appendChild(window);
    console.log('Flash AI: Top banner added!');

    // Add inline widget on product pages
    if (isProductPage()) {
      console.log('Flash AI: Product page detected');

      setTimeout(() => {
        const buttons = document.querySelectorAll('button');
        let targetButton = null;

        for (const button of buttons) {
          const text = button.textContent.toLowerCase();
          if (text.includes('buy it now') || text.includes('buy now')) {
            targetButton = button;
            break;
          }
        }

        if (targetButton) {
          const inline = createInlineWidget();
          if (targetButton.nextSibling) {
            targetButton.parentNode.insertBefore(inline, targetButton.nextSibling);
          } else {
            targetButton.parentNode.appendChild(inline);
          }
          console.log('Flash AI: Inline widget added!');
        }
      }, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('Flash AI: Widget loaded successfully!');
})();
