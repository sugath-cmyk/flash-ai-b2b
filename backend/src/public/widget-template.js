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
  let isExpanded = false;

  // Detect product page
  function isProductPage() {
    return window.location.pathname.includes('/products/');
  }

  // Create subtle collapsible widget
  function createSubtleWidget() {
    const widget = document.createElement('div');
    widget.id = 'flash-ai-widget';
    widget.style.cssText = `
      margin: 30px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s ease;
    `;

    // Collapsed state - subtle call to action
    const collapsedView = document.createElement('div');
    collapsedView.id = 'flash-ai-collapsed';
    collapsedView.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #f8f9fa;
      border: 1px solid #e3e6e8;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    collapsedView.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
          </svg>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 15px; font-weight: 600; color: #2c3e50; margin-bottom: 2px;">Have questions about this product?</div>
          <div style="font-size: 12px; color: #6c757d;">Ask our AI assistant • <span style="opacity: 0.7;">powered by Flash AI</span></div>
        </div>
        <svg id="flash-ai-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" style="transition: transform 0.3s ease; flex-shrink: 0;">
          <path d="M7 10l5 5 5-5" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    // Hover effect for collapsed view
    collapsedView.onmouseenter = () => {
      collapsedView.style.background = '#f0f2f5';
      collapsedView.style.borderColor = '#d0d4d8';
    };
    collapsedView.onmouseleave = () => {
      collapsedView.style.background = '#f8f9fa';
      collapsedView.style.borderColor = '#e3e6e8';
    };

    // Expanded state - chat interface
    const expandedView = document.createElement('div');
    expandedView.id = 'flash-ai-expanded';
    expandedView.style.cssText = `
      display: none;
      border: 1px solid #e3e6e8;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    `;

    expandedView.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
          </svg>
          <div>
            <div style="font-size: 15px; font-weight: 600;">AI Assistant</div>
            <div style="font-size: 10px; opacity: 0.85;">powered by Flash AI</div>
          </div>
        </div>
        <button id="flash-ai-collapse" style="background: none; border: none; color: white; cursor: pointer; font-size: 24px; padding: 0; width: 30px; height: 30px; opacity: 0.9; transition: opacity 0.2s;">×</button>
      </div>
      <div id="flash-ai-messages" style="min-height: 250px; max-height: 350px; overflow-y: auto; padding: 20px; background: #f8f9fa;"></div>
      <div style="padding: 16px; background: white; border-top: 1px solid #e3e6e8; display: flex; gap: 10px;">
        <input type="text" id="flash-ai-input" placeholder="Ask anything..." style="flex: 1; padding: 12px 16px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;" />
        <button id="flash-ai-send" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: opacity 0.2s;">Send</button>
      </div>
    `;

    widget.appendChild(collapsedView);
    widget.appendChild(expandedView);

    // Click handlers
    collapsedView.onclick = () => toggleWidget(true);

    setTimeout(() => {
      const collapseBtn = document.getElementById('flash-ai-collapse');
      const sendBtn = document.getElementById('flash-ai-send');
      const input = document.getElementById('flash-ai-input');

      if (collapseBtn) collapseBtn.onclick = () => toggleWidget(false);
      if (sendBtn) sendBtn.onclick = sendMessage;
      if (input) {
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
        input.onfocus = () => { input.style.borderColor = '#667eea'; };
        input.onblur = () => { input.style.borderColor = '#dee2e6'; };
      }
    }, 0);

    return widget;
  }

  function toggleWidget(expand) {
    isExpanded = expand;
    const collapsed = document.getElementById('flash-ai-collapsed');
    const expanded = document.getElementById('flash-ai-expanded');
    const chevron = document.getElementById('flash-ai-chevron');

    if (expand) {
      collapsed.style.display = 'none';
      expanded.style.display = 'block';

      // Add welcome message on first expand
      const messages = document.getElementById('flash-ai-messages');
      if (messages && messages.children.length === 0) {
        addMessage('Hi! I\'m here to help answer any questions about this product. What would you like to know?', 'bot');
      }

      // Focus input
      setTimeout(() => {
        const input = document.getElementById('flash-ai-input');
        if (input) input.focus();
      }, 100);
    } else {
      collapsed.style.display = 'flex';
      expanded.style.display = 'none';
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  }

  function addMessage(text, sender) {
    const container = document.getElementById('flash-ai-messages');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      margin-bottom: 14px;
      display: flex;
      ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 75%;
      padding: 10px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      ${sender === 'user'
        ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 4px;'
        : 'background: white; color: #2c3e50; border-bottom-left-radius: 4px; border: 1px solid #e3e6e8;'
      }
    `;
    bubble.textContent = text;
    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('flash-ai-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    const container = document.getElementById('flash-ai-messages');
    const typing = document.createElement('div');
    typing.id = 'flash-ai-typing';
    typing.style.cssText = 'margin-bottom: 14px; font-size: 13px; color: #6c757d; font-style: italic; padding-left: 4px;';
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
        const widget = createSubtleWidget();
        if (targetButton.nextSibling) {
          targetButton.parentNode.insertBefore(widget, targetButton.nextSibling);
        } else {
          targetButton.parentNode.appendChild(widget);
        }
        console.log('Flash AI: Subtle widget added!');
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
