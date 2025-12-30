(function() {
  'use strict';

  const WIDGET_VERSION = 'v1.2.0-debug';
  console.log('Flash AI: Widget initializing...', WIDGET_VERSION);

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
  let productContext = null;

  // Detect product page
  function isProductPage() {
    return window.location.pathname.includes('/products/');
  }

  // Extract product information from the page
  function extractProductContext() {
    if (!isProductPage()) {
      console.log('Flash AI: Not on product page, no product context');
      return null;
    }

    try {
      const context = {};

      // Try to get product data from Shopify's JSON
      if (window.meta && window.meta.product) {
        context.productId = window.meta.product.id?.toString();
        context.productTitle = window.meta.product.title;
        context.price = window.meta.product.price;
        context.vendor = window.meta.product.vendor;
      }

      // Fallback: Extract from page elements
      if (!context.productTitle) {
        const titleElement = document.querySelector('h1.product-title, h1[class*="product"], .product__title, h1');
        if (titleElement) {
          context.productTitle = titleElement.textContent.trim();
        }
      }

      if (!context.price) {
        const priceElement = document.querySelector('.price, .product-price, [class*="price"]');
        if (priceElement) {
          context.price = priceElement.textContent.trim();
        }
      }

      // Try to get description
      const descElement = document.querySelector('.product-description, .product__description, [class*="description"]');
      if (descElement) {
        context.productDescription = descElement.textContent.trim().substring(0, 500);
      }

      // Get vendor from meta tags
      if (!context.vendor) {
        const vendorMeta = document.querySelector('meta[property="product:brand"]');
        if (vendorMeta) {
          context.vendor = vendorMeta.getAttribute('content');
        }
      }

      console.log('Flash AI: Extracted product context:', context);
      return context;
    } catch (error) {
      console.error('Flash AI: Error extracting product context:', error);
      return null;
    }
  }

  // Create minimal collapsible widget
  function createSubtleWidget() {
    const widget = document.createElement('div');
    widget.id = 'flash-ai-widget';
    widget.style.cssText = `
      margin: 20px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s ease;
      max-width: 100%;
    `;

    // Add responsive styles
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        #flash-ai-widget {
          margin: 10px 0;
        }
        #flash-ai-messages {
          max-height: 300px !important;
          min-height: 150px !important;
        }
        #flash-ai-expanded {
          border-radius: 8px !important;
        }
      }
      #flash-ai-messages::-webkit-scrollbar {
        width: 6px;
      }
      #flash-ai-messages::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 10px;
      }
      #flash-ai-messages::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 10px;
      }
      #flash-ai-messages::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
      }
    `;
    document.head.appendChild(style);

    // Collapsed state - minimal single line
    const collapsedView = document.createElement('div');
    collapsedView.id = 'flash-ai-collapsed';
    collapsedView.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      background: transparent;
      border: 1px solid #e3e6e8;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    collapsedView.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6c757d;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#667eea"/>
        </svg>
        <span>Questions? Ask AI</span>
        <span style="font-size: 10px; opacity: 0.6;">• powered by Flash AI</span>
      </div>
    `;

    // Hover effect for collapsed view
    collapsedView.onmouseenter = () => {
      collapsedView.style.background = '#f8f9fa';
      collapsedView.style.borderColor = '#667eea';
    };
    collapsedView.onmouseleave = () => {
      collapsedView.style.background = 'transparent';
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
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
          </svg>
          <div>
            <div style="font-size: 13px; font-weight: 600;">AI Assistant</div>
            <div style="font-size: 9px; opacity: 0.8;">powered by Flash AI</div>
          </div>
        </div>
        <button id="flash-ai-collapse" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0; width: 24px; height: 24px; opacity: 0.9; transition: opacity 0.2s;">×</button>
      </div>
      <div id="flash-ai-messages" style="min-height: 200px; max-height: 400px; overflow-y: auto; padding: 16px; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; scroll-behavior: smooth;"></div>
      <div style="padding: 12px; background: white; border-top: 1px solid #e3e6e8; display: flex; gap: 8px;">
        <input type="text" id="flash-ai-input" placeholder="Ask anything..." style="flex: 1; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 13px; outline: none; transition: border-color 0.2s;" />
        <button id="flash-ai-send" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: opacity 0.2s;">Send</button>
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
        let welcomeMsg = 'Hi! I\'m here to help answer any questions about this product. What would you like to know?';

        // Personalize if we have product context
        if (productContext && productContext.productTitle) {
          welcomeMsg = `Hi! I'm here to help answer questions about ${productContext.productTitle}. What would you like to know?`;
        }

        addMessage(welcomeMsg, 'bot');
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
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
      ${sender === 'user'
        ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 4px;'
        : 'background: white; color: #2c3e50; border-bottom-left-radius: 4px; border: 1px solid #e3e6e8; box-shadow: 0 1px 2px rgba(0,0,0,0.05);'
      }
    `;

    // Format the message for better readability
    if (sender === 'bot') {
      bubble.innerHTML = formatBotMessage(text);
    } else {
      bubble.textContent = text;
    }

    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  function formatBotMessage(text) {
    // Preserve emojis and format text for chat display
    let formatted = text;

    // Convert markdown-style bullet points to HTML
    formatted = formatted.replace(/^[•\-\*]\s+(.+)$/gm, '<div style="display: flex; margin: 2px 0;"><span style="margin-right: 8px;">•</span><span>$1</span></div>');

    // Convert checkmarks to styled version
    formatted = formatted.replace(/^✅\s+(.+)$/gm, '<div style="display: flex; margin: 2px 0;"><span style="margin-right: 6px;">✅</span><span>$1</span></div>');

    // Convert warning signs
    formatted = formatted.replace(/^⚠️\s+(.+)$/gm, '<div style="display: flex; margin: 2px 0;"><span style="margin-right: 6px;">⚠️</span><span>$1</span></div>');

    // Bold text **text** or __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Preserve double line breaks as smaller paragraphs
    formatted = formatted.replace(/\n\n+/g, '<div style="height: 4px;"></div>');

    // Convert single line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  async function sendMessage() {
    console.log('Flash AI: sendMessage called');
    const input = document.getElementById('flash-ai-input');
    if (!input) {
      console.error('Flash AI: Input element not found');
      return;
    }

    const message = input.value.trim();
    if (!message) {
      console.log('Flash AI: Empty message, skipping');
      return;
    }

    console.log('Flash AI: Sending message:', message);
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
      console.log('Flash AI: Making API request to:', `${API_BASE_URL}/api/widget/chat`);
      console.log('Flash AI: Using API Key:', API_KEY.substring(0, 10) + '...');

      const requestBody = {
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
        message: message,
        conversationId: conversationId
      };

      // Include product context if available
      if (productContext) {
        requestBody.productContext = productContext;
        console.log('Flash AI: Including product context in request');
      }

      const response = await fetch(`${API_BASE_URL}/api/widget/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Flash AI: API response status:', response.status);
      const data = await response.json();
      console.log('Flash AI: API response data:', data);

      typing.remove();

      if (data.success) {
        conversationId = data.data.conversationId;
        console.log('Flash AI: Conversation ID:', conversationId);

        // API returns 'message' not 'response'
        const botMessage = data.data.message || data.data.response || 'Sorry, no response received.';
        console.log('Flash AI: Bot message:', botMessage.substring(0, 50) + '...');
        addMessage(botMessage, 'bot');
        console.log('Flash AI: Message added to chat');
      } else {
        console.error('Flash AI: API returned success: false', data);
        addMessage('Sorry, something went wrong. Please try again.', 'bot');
      }
    } catch (error) {
      console.error('Flash AI: Catch error:', error);
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

    // Extract product context for this page
    productContext = extractProductContext();

    setTimeout(() => {
      console.log('Flash AI: Searching for insertion point...');

      // Strategy 1: Find product form
      let targetElement = document.querySelector('form[action*="/cart/add"]');
      if (targetElement) {
        console.log('Flash AI: Found product form');
      }

      // Strategy 2: Find Buy button (multiple variations)
      if (!targetElement) {
        const buttons = document.querySelectorAll('button, input[type="submit"], a.button');
        console.log('Flash AI: Found', buttons.length, 'buttons/inputs');

        for (const button of buttons) {
          const text = button.textContent?.toLowerCase() || button.value?.toLowerCase() || '';
          console.log('Flash AI: Button text:', text.substring(0, 50));

          if (text.includes('buy') ||
              text.includes('add to cart') ||
              text.includes('purchase') ||
              text.includes('checkout')) {
            targetElement = button;
            console.log('Flash AI: Found target button:', text.substring(0, 30));
            break;
          }
        }
      }

      // Strategy 3: Find product info section
      if (!targetElement) {
        targetElement = document.querySelector('.product-form, .product-info, .product-details, [class*="product"]');
        if (targetElement) {
          console.log('Flash AI: Using product section as fallback');
        }
      }

      // Strategy 4: Last resort - use main content
      if (!targetElement) {
        targetElement = document.querySelector('main, #main, .main-content');
        console.log('Flash AI: Using main content as last resort');
      }

      if (targetElement) {
        const widget = createSubtleWidget();

        // Insert after the target element
        if (targetElement.nextSibling) {
          targetElement.parentNode.insertBefore(widget, targetElement.nextSibling);
        } else {
          targetElement.parentNode.appendChild(widget);
        }

        console.log('Flash AI: Widget added successfully!');
      } else {
        console.error('Flash AI: Could not find suitable insertion point');
      }
    }, 2000); // Increased timeout to 2 seconds
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('Flash AI: Widget script loaded');
})();
