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

  let conversationId = null;

  // Detect product page
  function isProductPage() {
    return window.location.pathname.includes('/products/');
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

      if (sendBtn) sendBtn.onclick = sendMessage;
      if (input) {
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
      }

      addMessage('Ask anything about this product', 'bot');
    }, 0);

    return widget;
  }

  function addMessage(text, sender) {
    const container = document.getElementById('flash-ai-inline-messages');
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

  async function sendMessage() {
    const input = document.getElementById('flash-ai-inline-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    const container = document.getElementById('flash-ai-inline-messages');
    const typing = document.createElement('div');
    typing.id = 'flash-ai-typing';
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
        addMessage(data.data.response, 'bot');
      } else {
        addMessage('Sorry, something went wrong. Please try again.', 'bot');
      }
    } catch (error) {
      console.error('Flash AI: Error:', error);
      typing.remove();
      addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
    }
  }

  // Initialize
  function init() {
    // Only add widget on product pages
    if (!isProductPage()) {
      console.log('Flash AI: Not a product page, skipping widget');
      return;
    }

    console.log('Flash AI: Product page detected, creating widget...');

    setTimeout(() => {
      const buttons = document.querySelectorAll('button');
      let targetButton = null;

      // Find Buy it now button
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
        console.log('Flash AI: Widget added below Buy it now button!');
      } else {
        console.log('Flash AI: Buy it now button not found');
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('Flash AI: Widget script loaded');
})();
