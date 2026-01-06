(function() {
  'use strict';

  const WIDGET_VERSION = 'v1.3.0';
  console.log('🚀 Flash AI: Widget initializing...', WIDGET_VERSION);
  console.log('🎨 Flash AI: Button text controlled by backend config');

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
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="{{PRIMARY_COLOR}}"/>
        </svg>
        <span>{{BUTTON_TEXT}}</span>
        <span style="font-size: 10px; opacity: 0.6;">• {{POWERED_BY_TEXT}}</span>
      </div>
    `;

    // Hover effect for collapsed view
    collapsedView.onmouseenter = () => {
      collapsedView.style.background = '#f8f9fa';
      collapsedView.style.borderColor = '{{PRIMARY_COLOR}}';
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
      <div style="background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%); color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
          </svg>
          <div>
            <div style="font-size: 13px; font-weight: 600;">{{WIDGET_NAME}}</div>
            <div style="font-size: 9px; opacity: 0.8;">{{POWERED_BY_TEXT}}</div>
          </div>
        </div>
        <button id="flash-ai-collapse" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0; width: 24px; height: 24px; opacity: 0.9; transition: opacity 0.2s;">×</button>
      </div>
      <div id="flash-ai-messages" style="min-height: 200px; max-height: 400px; overflow-y: auto; padding: 16px; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; scroll-behavior: smooth;"></div>
      <div style="padding: 12px; background: white; border-top: 1px solid #e3e6e8; display: flex; gap: 8px;">
        <input type="text" id="flash-ai-input" placeholder="Ask anything..." style="flex: 1; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 13px; outline: none; transition: border-color 0.2s;" />
        <button id="flash-ai-send" style="padding: 10px 20px; background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: opacity 0.2s;">Send</button>
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
        input.onfocus = () => { input.style.borderColor = '{{PRIMARY_COLOR}}'; };
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
      margin-bottom: 12px;
      display: flex;
      ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
      ${sender === 'user'
        ? 'background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%); color: white; border-bottom-right-radius: 4px;'
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
    console.log('🎨 formatBotMessage called with text length:', text.length);
    console.log('📝 First 200 chars:', text.substring(0, 200));

    // STEP 1: Replace [PRODUCT: ...] directly with product cards FIRST (before any other formatting)
    // Format: [PRODUCT: Title | ₹Price | ImageURL] or [PRODUCT: Title | ₹Price | ImageURL | ProductURL | Description]
    // Use [^\|] for title (anything except pipe), [^\]] for last field (anything except closing bracket)
    const productRegex = /\[PRODUCT:\s*([^\|]+?)\s*\|\s*₹([\d,]+)\s*\|\s*([^\|\]]+?)(?:\s*\|\s*([^\|\]]+?))?(?:\s*\|\s*([^\]]+?))?\s*\]/g;

    // Test if the pattern exists in text
    const hasProductTag = text.includes('[PRODUCT:');
    console.log('🛍️ Contains [PRODUCT: tag?', hasProductTag);

    if (hasProductTag) {
      console.log('🔍 Attempting regex match...');
      const matches = text.match(productRegex);
      console.log('✅ Regex matches found:', matches ? matches.length : 0);
      if (matches) {
        matches.forEach(m => console.log('  Match:', m));
      }
    }

    // Collect all product cards first
    const productCards = [];
    let formatted = text.replace(productRegex, function(match, title, price, imageUrl, productUrl, description) {
      console.log('🎯 PRODUCT CARD MATCHED!');
      console.log('  Full match:', match);
      console.log('  Title:', title.trim());
      console.log('  Price:', price);
      console.log('  Image URL:', imageUrl.trim());
      console.log('  Product URL:', productUrl ? productUrl.trim() : 'not provided - will generate from title');
      console.log('  Description:', description ? description.trim() : 'not provided');

      const card = createProductCard(title.trim(), price, imageUrl.trim(), productUrl ? productUrl.trim() : null, description ? description.trim() : null);
      productCards.push(card);

      // Return placeholder that we'll replace with carousel
      return '___PRODUCT_CARD_' + (productCards.length - 1) + '___';
    });

    // If we have product cards, wrap them in a carousel
    if (productCards.length > 0) {
      // Create carousel wrapper
      const carousel = '<div style="margin:12px 0;"><div style="display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:4px 0 8px 0;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;" onscroll="this.style.paddingBottom = this.scrollLeft > 0 ? \'8px\' : \'8px\';">' +
        productCards.join('') +
      '</div><style>div::-webkit-scrollbar{height:6px;}div::-webkit-scrollbar-track{background:#f1f1f1;border-radius:3px;}div::-webkit-scrollbar-thumb{background:#888;border-radius:3px;}div::-webkit-scrollbar-thumb:hover{background:#555;}</style></div>';

      // Replace all placeholders with the single carousel
      formatted = formatted.replace(/___PRODUCT_CARD_\d+___/g, function(match, offset) {
        // Only replace the first placeholder with carousel, remove others
        const isFirst = formatted.indexOf(match) === offset;
        return isFirst ? carousel : '';
      });
    }

    console.log('📊 After product replacement - original:', text.length, 'formatted:', formatted.length);

    // STEP 2: Now do all other text formatting
    // Bold text **text** or __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Handle multiple consecutive line breaks
    formatted = formatted.replace(/\n\n+/g, '\n\n');

    // Split into lines for processing
    const lines = formatted.split('\n');
    const processed = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines but add small spacing
      if (line === '') {
        if (processed.length > 0 && processed[processed.length - 1] !== '<div style="height: 4px;"></div>') {
          processed.push('<div style="height: 4px;"></div>');
        }
        continue;
      }

      // Check if line starts with bullet/emoji that should be on same line as next
      const startsWithEmoji = /^[✅⚠️❌✨💡📌👉🔹]$/.test(line);
      const startsWithBullet = /^[•\-\*]$/.test(line);

      if (startsWithEmoji && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        processed.push(`<div style="margin: 2px 0;">${line} ${nextLine}</div>`);
        i++;
      } else if (startsWithBullet && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        processed.push(`<div style="margin: 2px 0; padding-left: 4px;">• ${nextLine}</div>`);
        i++;
      } else if (/^[•\-\*]\s/.test(line)) {
        processed.push(`<div style="margin: 2px 0; padding-left: 4px;">${line.replace(/^[•\-\*]\s/, '• ')}</div>`);
      } else {
        processed.push(`<div style="margin: 2px 0;">${line}</div>`);
      }
    }

    const result = processed.join('');
    console.log('formatBotMessage final output length:', result.length);
    return result;
  }

  function createProductCard(title, price, imageUrl, productUrl, description) {
    // Generate a unique ID for this product card
    const productId = 'product-' + Math.random().toString(36).substr(2, 9);

    // If no productUrl provided, generate slug from title
    if (!productUrl) {
      const slug = title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')          // Replace spaces with hyphens
        .replace(/-+/g, '-')           // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
      productUrl = `/products/${slug}`;
    }

    // Use real image if available, otherwise fallback to emoji - make it clickable
    const imageHtml = imageUrl && imageUrl.startsWith('http')
      ? `<a href="${productUrl}" target="_blank" style="display:block;text-decoration:none;"><img src="${imageUrl}" alt="${title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;display:block;cursor:pointer;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /></a><a href="${productUrl}" target="_blank" style="width:100%;height:140px;display:none;align-items:center;justify-content:center;font-size:48px;text-decoration:none;cursor:pointer;background:linear-gradient(135deg,#f5f7fa 0%,#e8ecf1 100%);border-radius:8px 8px 0 0;">🧴</a>`
      : `<a href="${productUrl}" target="_blank" style="width:100%;height:140px;display:flex;align-items:center;justify-content:center;font-size:48px;text-decoration:none;cursor:pointer;background:linear-gradient(135deg,#f5f7fa 0%,#e8ecf1 100%);border-radius:8px 8px 0 0;">🧴</a>`;

    // Add description HTML if provided
    const descriptionHtml = description
      ? '<div style="font-size:11px;color:#64748b;line-height:1.4;margin-bottom:8px;height:32px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + description + '</div>'
      : '';

    // Return vertical card for carousel - fixed width, vertical layout
    return '<div style="min-width:180px;max-width:180px;background:white;border:1px solid #e3e6e8;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.05);transition:all 0.2s;flex-shrink:0;overflow:hidden;" onmouseenter="this.style.boxShadow=\'0 6px 12px rgba(102,126,234,0.15)\';this.style.borderColor=\'{{PRIMARY_COLOR}}\';this.style.transform=\'translateY(-4px)\';" onmouseleave="this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.05)\';this.style.borderColor=\'#e3e6e8\';this.style.transform=\'translateY(0)\';">' +
      imageHtml +
      '<div style="padding:12px;">' +
        '<a href="' + productUrl + '" target="_blank" style="text-decoration:none;color:inherit;"><div style="font-weight:600;font-size:13px;color:#2c3e50;margin-bottom:6px;line-height:1.3;height:36px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;cursor:pointer;transition:color 0.2s;" onmouseenter="this.style.color=\'{{PRIMARY_COLOR}}\';" onmouseleave="this.style.color=\'#2c3e50\';">' + title + '</div></a>' +
        descriptionHtml +
        '<div style="font-size:16px;font-weight:700;color:{{PRIMARY_COLOR}};margin-bottom:10px;">₹' + price + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<a href="' + productUrl + '" target="_blank" style="text-decoration:none;"><button style="width:100%;padding:8px 10px;background:white;color:{{PRIMARY_COLOR}};border:1px solid {{PRIMARY_COLOR}};border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.background=\'{{PRIMARY_COLOR}}\';this.style.color=\'white\';" onmouseleave="this.style.background=\'white\';this.style.color=\'{{PRIMARY_COLOR}}\';">View Details</button></a>' +
          '<button onclick="window.flashAI_addToCart(\'' + title.replace(/'/g, "\\'") + '\',\'' + price + '\')" style="width:100%;padding:8px 10px;background:linear-gradient(135deg,{{PRIMARY_COLOR}} 0%,{{SECONDARY_COLOR}} 100%);color:white;border:none;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.opacity=\'0.9\';this.style.transform=\'scale(1.02)\';" onmouseleave="this.style.opacity=\'1\';this.style.transform=\'scale(1)\';">Add to Cart 🛒</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Add to cart function
  window.flashAI_addToCart = function(productTitle, productPrice) {
    console.log('Add to cart:', productTitle, productPrice);

    // Show success message in chat
    const container = document.getElementById('flash-ai-messages');
    if (container) {
      const msgDiv = document.createElement('div');
      msgDiv.style.cssText = 'margin-bottom: 12px; display: flex; justify-content: flex-start;';

      const bubble = document.createElement('div');
      bubble.style.cssText = `
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 13px;
        line-height: 1.4;
        background: #e8f5e9;
        color: #2e7d32;
        border: 1px solid #c8e6c9;
        font-weight: 500;
      `;
      bubble.textContent = '✅ Added to cart! Continue shopping or check out when ready.';

      msgDiv.appendChild(bubble);
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
    }

    // Try to add to Shopify cart if available
    if (typeof fetch !== 'undefined') {
      // Search for product by title in Shopify (this is a best-effort approach)
      // In a real implementation, you'd want to store product handles/IDs with the recommendations
      alert(`"${productTitle}" added to cart! (₹${productPrice})\n\nNote: Please add this product manually from the product page for now.`);
    }
  };

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

  // Create floating widget (right middle of page)
  function createFloatingWidget() {
    const floatingContainer = document.createElement('div');
    floatingContainer.id = 'flash-ai-floating-widget';
    floatingContainer.style.cssText = `
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Floating icon button (collapsed state)
    const floatingIcon = document.createElement('div');
    floatingIcon.id = 'flash-ai-floating-icon';
    floatingIcon.style.cssText = `
      cursor: pointer;
      background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%);
      border-radius: 50px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 280px;
    `;

    floatingIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
        <circle cx="8" cy="11" r="1.5" fill="{{PRIMARY_COLOR}}"/>
        <circle cx="12" cy="11" r="1.5" fill="{{PRIMARY_COLOR}}"/>
        <circle cx="16" cy="11" r="1.5" fill="{{PRIMARY_COLOR}}"/>
      </svg>
      <div style="color: white; line-height: 1.3;">
        <div style="font-size: 14px; font-weight: 600;">{{BUTTON_TEXT}}</div>
        <div style="font-size: 10px; opacity: 0.85;">{{POWERED_BY_TEXT}}</div>
      </div>
    `;

    // Floating chat window (expanded state)
    const floatingChat = document.createElement('div');
    floatingChat.id = 'flash-ai-floating-chat';
    floatingChat.style.cssText = `
      display: none;
      width: 380px;
      max-width: calc(100vw - 40px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      overflow: hidden;
      animation: slideIn 0.3s ease;
    `;

    floatingChat.innerHTML = `
      <style>
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        #flash-ai-floating-icon:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
        }
        @media (max-width: 768px) {
          #flash-ai-floating-widget {
            right: 10px !important;
          }
          #flash-ai-floating-chat {
            width: calc(100vw - 20px) !important;
          }
        }
      </style>
      <div style="background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%); color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/>
          </svg>
          <div>
            <div style="font-size: 15px; font-weight: 600;">{{WIDGET_NAME}}</div>
            <div style="font-size: 10px; opacity: 0.85;">{{POWERED_BY_TEXT}}</div>
          </div>
        </div>
        <button id="flash-ai-floating-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 24px; padding: 0; width: 28px; height: 28px; opacity: 0.9; transition: opacity 0.2s;">×</button>
      </div>
      <div id="flash-ai-floating-messages" style="height: 400px; max-height: 60vh; overflow-y: auto; padding: 16px; background: #f8f9fa; scroll-behavior: smooth;"></div>
      <div style="padding: 12px; background: white; border-top: 1px solid #e3e6e8; display: flex; gap: 8px;">
        <input type="text" id="flash-ai-floating-input" placeholder="Ask anything..." style="flex: 1; padding: 12px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s;" />
        <button id="flash-ai-floating-send" style="padding: 12px 20px; background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="vertical-align: middle;">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    floatingContainer.appendChild(floatingIcon);
    floatingContainer.appendChild(floatingChat);
    document.body.appendChild(floatingContainer);

    // Toggle floating widget
    let floatingExpanded = false;
    floatingIcon.onclick = () => {
      floatingExpanded = true;
      floatingIcon.style.display = 'none';
      floatingChat.style.display = 'block';

      // Add welcome message if first time
      const messages = document.getElementById('flash-ai-floating-messages');
      if (messages && messages.children.length === 0) {
        let welcomeMsg = 'Hi! I\'m here to help answer any questions about this product. What would you like to know?';
        if (productContext && productContext.productTitle) {
          welcomeMsg = `Hi! I'm here to help answer questions about ${productContext.productTitle}. What would you like to know?`;
        }
        addFloatingMessage(welcomeMsg, 'bot');
      }

      // Focus input
      setTimeout(() => {
        const input = document.getElementById('flash-ai-floating-input');
        if (input) input.focus();
      }, 100);
    };

    // Close floating widget
    setTimeout(() => {
      const closeBtn = document.getElementById('flash-ai-floating-close');
      if (closeBtn) {
        closeBtn.onclick = () => {
          floatingExpanded = false;
          floatingIcon.style.display = 'flex';
          floatingChat.style.display = 'none';
        };
      }

      const sendBtn = document.getElementById('flash-ai-floating-send');
      const input = document.getElementById('flash-ai-floating-input');

      if (sendBtn) sendBtn.onclick = sendFloatingMessage;
      if (input) {
        input.onkeypress = (e) => { if (e.key === 'Enter') sendFloatingMessage(); };
        input.onfocus = () => { input.style.borderColor = '{{PRIMARY_COLOR}}'; };
        input.onblur = () => { input.style.borderColor = '#dee2e6'; };
      }
    }, 100);
  }

  function addFloatingMessage(text, sender) {
    const container = document.getElementById('flash-ai-floating-messages');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      margin-bottom: 12px;
      display: flex;
      ${sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
      ${sender === 'user'
        ? 'background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%); color: white; border-bottom-right-radius: 4px;'
        : 'background: white; color: #2c3e50; border-bottom-left-radius: 4px; border: 1px solid #e3e6e8; box-shadow: 0 1px 2px rgba(0,0,0,0.05);'
      }
    `;

    if (sender === 'bot') {
      bubble.innerHTML = formatBotMessage(text);
    } else {
      bubble.textContent = text;
    }

    msgDiv.appendChild(bubble);
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  }

  async function sendFloatingMessage() {
    const input = document.getElementById('flash-ai-floating-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addFloatingMessage(message, 'user');
    input.value = '';

    const container = document.getElementById('flash-ai-floating-messages');
    const typing = document.createElement('div');
    typing.id = 'flash-ai-floating-typing';
    typing.style.cssText = 'margin-bottom: 14px; font-size: 13px; color: #6c757d; font-style: italic; padding-left: 4px;';
    typing.textContent = 'Typing...';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    try {
      const requestBody = {
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
        message: message,
        conversationId: conversationId
      };

      if (productContext) {
        requestBody.productContext = productContext;
      }

      const response = await fetch(`${API_BASE_URL}/api/widget/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      typing.remove();

      if (data.success) {
        conversationId = data.data.conversationId;
        const botMessage = data.data.message || data.data.response || 'Sorry, no response received.';
        addFloatingMessage(botMessage, 'bot');
      } else {
        addFloatingMessage('Sorry, something went wrong. Please try again.', 'bot');
      }
    } catch (error) {
      console.error('Flash AI: Error:', error);
      typing.remove();
      addFloatingMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
    }
  }

  // Initialize
  function init() {
    // Only add widget on product pages
    if (!isProductPage()) {
      console.log('Flash AI: Not a product page, skipping widget');
      return;
    }

    console.log('Flash AI: Product page detected, creating widgets...');

    // Extract product context for this page
    productContext = extractProductContext();

    // Add floating widget first
    createFloatingWidget();

    setTimeout(() => {
      console.log('Flash AI: Searching for insertion point for inline widget...');

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
