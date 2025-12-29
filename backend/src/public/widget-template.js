(function() {
  'use strict';

  // IMMEDIATE EXECUTION TEST - This should show even if everything else fails
  console.log('=== FLASH AI: SCRIPT IS LOADING ===');
  alert('Flash AI script loaded! If you see this, the script is working.');

  // Get store ID from config
  const storeId = window.flashAIConfig?.storeId;

  console.log('Flash AI: window.flashAIConfig =', window.flashAIConfig);
  console.log('Flash AI: storeId =', storeId);

  if (!storeId) {
    console.error('Flash AI: Store ID not configured');
    alert('Flash AI Error: Store ID not configured. Check console for details.');
    return;
  }

  const API_BASE_URL = '{{API_BASE_URL}}';
  const API_KEY = '{{API_KEY}}';

  console.log('Flash AI: API_BASE_URL =', API_BASE_URL);
  console.log('Flash AI: API_KEY =', API_KEY);

  // Simple test - create a very obvious banner
  function createTestBanner() {
    console.log('Flash AI: Creating test banner...');

    const banner = document.createElement('div');
    banner.id = 'flash-ai-test-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        text-align: center;
        font-size: 18px;
        font-weight: bold;
        z-index: 999999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      ">
        🎉 Flash AI Widget is Working! Click here to chat
      </div>
    `;

    banner.onclick = function() {
      alert('Widget clicked! Store ID: ' + storeId);
    };

    document.body.appendChild(banner);
    console.log('Flash AI: Test banner added to page!');
    console.log('Flash AI: Banner element:', banner);
  }

  // Try to create banner immediately
  try {
    if (document.body) {
      console.log('Flash AI: document.body exists, adding banner now');
      createTestBanner();
    } else {
      console.log('Flash AI: document.body not ready, waiting for DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', function() {
        console.log('Flash AI: DOMContentLoaded fired');
        createTestBanner();
      });
    }
  } catch (error) {
    console.error('Flash AI: Error creating banner:', error);
    alert('Flash AI Error: ' + error.message);
  }

  // Also try with window.onload as backup
  window.addEventListener('load', function() {
    console.log('Flash AI: window.load event fired');
    if (!document.getElementById('flash-ai-test-banner')) {
      console.log('Flash AI: Banner not found, trying to add again');
      createTestBanner();
    }
  });

  console.log('Flash AI: Script setup complete');
})();
