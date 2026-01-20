/**
 * Flash AI Virtual Try-On & Face Scan Widget
 * Version: 3.0.0 (Full Skincare Platform)
 *
 * Embeddable widget for virtual try-on, face scan, progress tracking,
 * goal setting, personalized routines, and AI predictions.
 *
 * Usage:
 * <script src="https://your-domain.com/api/vto/YOUR_STORE_ID.js"></script>
 */

(function() {
  'use strict';

  // Version check for debugging
  console.log('[Flash AI Widget] Version 3.0.0 - Full Skincare Platform');

  // ==========================================================================
  // Main Widget Class
  // ==========================================================================

  class FlashAI_VTO_Widget {
    constructor(config) {
      this.config = {
        storeId: config.storeId,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl || 'https://flash-ai-backend.onrender.com/api/vto',
        mode: config.mode || 'floating', // 'floating' | 'inline' | 'both'
        buttonPosition: config.buttonPosition || 'bottom-right',
        buttonText: config.buttonText || 'Try On',
        primaryColor: config.primaryColor || '#000000',
        productId: config.productId || this.extractProductId(),
        variantId: config.variantId || null,
      };

      this.state = {
        currentStep: 'idle', // idle | scanning | processing | tryon | error
        bodyScan: null,
        session: null,
        photos: [],
        cameraStream: null,
        visitorId: this.getOrCreateVisitorId(),
        authToken: null,
        user: null,
        routines: null,
      };

      this.elements = {};
      this.pollInterval = null;

      this.init();
    }

    // ==========================================================================
    // Initialization
    // ==========================================================================

    init() {
      // Load styles
      this.injectStyles();

      // Check for stored authentication
      this.checkStoredAuth();

      // Initialize widget based on mode
      if (this.config.mode === 'floating' || this.config.mode === 'both') {
        this.createFloatingButton();
      }

      if (this.config.mode === 'inline' || this.config.mode === 'both') {
        this.createInlineWidget();
      }

      // Listen for product changes (single-page apps)
      this.observeProductChanges();
    }

    injectStyles() {
      const styleId = 'flashai-vto-styles';
      if (document.getElementById(styleId)) return;

      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = this.config.apiBaseUrl.replace('/api/vto', '/widget/vto-styles.css');
      document.head.appendChild(link);

      // Inject critical keyframe animations as inline style (fallback for CSS caching)
      const criticalStyleId = 'flashai-vto-critical-styles';
      if (!document.getElementById(criticalStyleId)) {
        const style = document.createElement('style');
        style.id = criticalStyleId;
        style.textContent = `
          @keyframes flashai-pin-pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
          }
          @keyframes flashai-boundary-pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.5), inset 0 0 20px rgba(139,92,246,0.2); }
            50% { box-shadow: 0 0 35px rgba(139,92,246,0.8), inset 0 0 30px rgba(139,92,246,0.3); }
          }
          .flashai-vto-pin:hover { transform: translate(-50%, -50%) scale(1.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
          .flashai-vto-pin.highlight { transform: translate(-50%, -50%) scale(1.3); box-shadow: 0 0 0 4px rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.4); z-index: 20; }
          .flashai-vto-issue-item:hover { transform: translateX(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        `;
        document.head.appendChild(style);
      }
    }

    // ==========================================================================
    // UI Components
    // ==========================================================================

    createFloatingButton() {
      const button = document.createElement('button');
      button.id = 'flashai-vto-button';
      button.className = `flashai-vto-btn flashai-vto-btn-${this.config.buttonPosition}`;
      button.style.backgroundColor = this.config.primaryColor;
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>${this.config.buttonText}</span>
      `;

      button.addEventListener('click', () => this.openModal());
      document.body.appendChild(button);

      this.elements.floatingButton = button;
    }

    createInlineWidget() {
      const container = document.getElementById('flashai-vto-inline');
      if (!container) {
        console.warn('FlashAI VTO: Inline container #flashai-vto-inline not found');
        return;
      }

      container.innerHTML = `
        <div class="flashai-vto-inline-widget">
          <button class="flashai-vto-inline-btn" style="background-color: ${this.config.primaryColor}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>${this.config.buttonText}</span>
          </button>
        </div>
      `;

      const button = container.querySelector('.flashai-vto-inline-btn');
      button.addEventListener('click', () => this.openModal());

      this.elements.inlineButton = button;
    }

    openModal() {
      // Create modal if it doesn't exist
      if (!this.elements.modal) {
        this.createModal();
      }

      this.elements.modal.style.display = 'flex';
      document.body.style.overflow = '';

      // Show selection screen
      this.showStep('selection');
    }

    // API method for external use - can specify mode directly
    open(mode) {
      // Create modal if it doesn't exist
      if (!this.elements.modal) {
        this.createModal();
      }

      this.elements.modal.style.display = 'flex';
      document.body.style.overflow = '';

      // Go directly to specified mode or show selection
      if (mode === 'facescan') {
        this.showStep('facescan');
      } else if (mode === 'tryon') {
        this.showStep('scanning');
      } else {
        this.showStep('selection');
      }
    }

    // API method for external use
    close() {
      this.closeModal();
    }

    closeModal() {
      if (this.elements.modal) {
        this.elements.modal.style.display = 'none';
        document.body.style.overflow = '';

        // Stop cameras if active
        this.stopCamera();
        this.stopFaceCamera();

        // Cleanup 3D renderer
        if (this.renderer) {
          this.renderer.dispose();
          this.renderer = null;
        }

        // Reset state
        this.state.currentStep = 'idle';
        this.state.photos = [];
      }
    }

    createModal() {
      const modal = document.createElement('div');
      modal.id = 'flashai-vto-modal';
      modal.className = 'flashai-vto-modal';
      modal.innerHTML = `
        <div class="flashai-vto-overlay"></div>
        <div class="flashai-vto-content">
          <button class="flashai-vto-close">&times;</button>

          <!-- Step 0: Selection -->
          <div id="flashai-vto-step-selection" class="flashai-vto-step">
            <div class="flashai-vto-header">
              <h2>Welcome to Flash AI</h2>
              <p>Choose your experience</p>
            </div>

            <div class="flashai-vto-selection-grid">
              <button id="flashai-vto-select-tryon" class="flashai-vto-selection-card" style="background: #f5f5f5; border: 1px solid #e0e0e0;">
                <div class="flashai-vto-selection-icon" style="color: #9ca3af;">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <h3 style="color: #6b7280;">Virtual Try-On</h3>
                <p style="color: #9ca3af;">Visualize clothes on your body with AR</p>
              </button>

              <button id="flashai-vto-select-facescan" class="flashai-vto-selection-card" style="background: linear-gradient(135deg, #8b5cf620, #8b5cf635); border: 2px solid #8b5cf6; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.25);">
                <div class="flashai-vto-selection-icon" style="color: #8b5cf6;">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="9" cy="9" r="1" fill="currentColor"></circle>
                    <circle cx="15" cy="9" r="1" fill="currentColor"></circle>
                    <path d="M8 15s1.5 2 4 2 4-2 4-2"></path>
                  </svg>
                </div>
                <h3 style="color: #6d28d9; font-weight: 700;">Find My Shade</h3>
                <p style="color: #7c3aed;">AI skin analysis & product recommendations</p>
              </button>
            </div>
          </div>

          <!-- Step 1: Body Scanning -->
          <div id="flashai-vto-step-scanning" class="flashai-vto-step">
            <div class="flashai-vto-header">
              <h2>Take a Body Scan</h2>
              <p>We'll need 3-5 photos from different angles to create your 3D model</p>
            </div>

            <div class="flashai-vto-camera-container">
              <video id="flashai-vto-camera" autoplay playsinline></video>
              <div id="flashai-vto-camera-guide" class="flashai-vto-camera-guide">
                <div class="flashai-vto-guide-outline"></div>
                <div class="flashai-vto-guide-text">Position yourself within the frame</div>
              </div>
            </div>

            <div class="flashai-vto-photos-preview" id="flashai-vto-photos"></div>

            <div class="flashai-vto-actions">
              <button id="flashai-vto-capture" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Capture Photo
              </button>
              <button id="flashai-vto-process" class="flashai-vto-btn-success" style="display: none;">
                Process Scan (${this.state.photos.length}/3)
              </button>
            </div>

            <div class="flashai-vto-instructions">
              <h4>Tips for best results:</h4>
              <ul>
                <li>Stand in good lighting</li>
                <li>Wear form-fitting clothes</li>
                <li>Take photos from front, side, and back angles</li>
                <li>Keep your arms slightly away from your body</li>
              </ul>
            </div>
          </div>

          <!-- Step 2: Processing -->
          <div id="flashai-vto-step-processing" class="flashai-vto-step" style="display: none;">
            <div class="flashai-vto-header">
              <h2>Creating Your 3D Model</h2>
              <p>This usually takes 10-20 seconds...</p>
            </div>

            <div class="flashai-vto-loader-container">
              <div class="flashai-vto-loader"></div>
              <div class="flashai-vto-loader-text">Processing your body scan</div>
              <div class="flashai-vto-loader-progress">
                <div class="flashai-vto-progress-bar">
                  <div class="flashai-vto-progress-fill" id="flashai-vto-progress"></div>
                </div>
                <div class="flashai-vto-progress-text" id="flashai-vto-progress-text">0%</div>
              </div>
            </div>

            <div class="flashai-vto-processing-steps">
              <div class="flashai-vto-processing-step" data-step="1">
                <div class="flashai-vto-step-icon">✓</div>
                <div class="flashai-vto-step-text">Photos uploaded</div>
              </div>
              <div class="flashai-vto-processing-step" data-step="2">
                <div class="flashai-vto-step-icon">⋯</div>
                <div class="flashai-vto-step-text">Detecting body pose</div>
              </div>
              <div class="flashai-vto-processing-step" data-step="3">
                <div class="flashai-vto-step-icon">⋯</div>
                <div class="flashai-vto-step-text">Building 3D model</div>
              </div>
              <div class="flashai-vto-processing-step" data-step="4">
                <div class="flashai-vto-step-icon">⋯</div>
                <div class="flashai-vto-step-text">Extracting measurements</div>
              </div>
            </div>
          </div>

          <!-- Step 3: Virtual Try-On -->
          <div id="flashai-vto-step-tryon" class="flashai-vto-step" style="display: none;">
            <div class="flashai-vto-header">
              <h2>Virtual Try-On</h2>
              <div class="flashai-vto-size-rec" id="flashai-vto-size-rec">
                <span class="flashai-vto-size-label">Recommended Size:</span>
                <span class="flashai-vto-size-value" id="flashai-vto-size">-</span>
                <span class="flashai-vto-confidence" id="flashai-vto-confidence"></span>
              </div>
            </div>

            <div class="flashai-vto-canvas-container">
              <canvas id="flashai-vto-canvas"></canvas>
              <div class="flashai-vto-canvas-loader" id="flashai-vto-canvas-loader">
                <div class="flashai-vto-loader"></div>
                <div class="flashai-vto-loader-text">Loading 3D view...</div>
              </div>
            </div>

            <div class="flashai-vto-controls">
              <button id="flashai-vto-screenshot" class="flashai-vto-btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Screenshot
              </button>
              <button id="flashai-vto-share" class="flashai-vto-btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                Share
              </button>
              <button id="flashai-vto-add-to-cart" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                Add to Cart
              </button>
            </div>

            <div class="flashai-vto-fit-advice" id="flashai-vto-fit-advice">
              <h4>Fit Advice</h4>
              <p id="flashai-vto-fit-advice-text">-</p>
            </div>
          </div>

          <!-- Face Scan Step 1: Capture -->
          <div id="flashai-vto-step-facescan" class="flashai-vto-step">
            <div class="flashai-vto-header">
              <h2>Face Scan</h2>
              <p id="flashai-vto-face-angle-instruction">Align your face within the boundary</p>
            </div>

            <div class="flashai-vto-camera-container" style="position:relative;overflow:hidden;background:linear-gradient(135deg,#e8e0ff 0%,#f5f3ff 100%) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;">
              <!-- Loading overlay that hides the black video placeholder -->
              <div id="flashai-vto-camera-loading" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:6;background:linear-gradient(135deg,#e8e0ff 0%,#f5f3ff 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.3s ease;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;">
                <div style="width:50px;height:50px;border:4px solid #e9d5ff;border-top-color:#8b5cf6;border-radius:50%;animation:flashai-spin 1s linear infinite;"></div>
                <p style="margin-top:16px;color:#6b21a8;font-size:14px;font-weight:500;">Starting camera...</p>
              </div>
              <style>@keyframes flashai-spin{to{transform:rotate(360deg)}}</style>

              <video id="flashai-vto-face-camera" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;background:transparent !important;position:absolute;top:0;left:0;z-index:5;opacity:0;transition:opacity 0.3s ease;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;filter:none !important;-webkit-filter:none !important;"></video>

              <!-- Face Boundary Guide Overlay - transparent, no backgrounds -->
              <div id="flashai-vto-face-boundary" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;background:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;">
                <!-- Animated oval border only - NO inset shadow, just outer glow -->
                <div style="position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);width:60%;height:72%;border:3px dashed #8b5cf6;border-radius:50%;box-shadow:0 0 20px rgba(139,92,246,0.5);animation:flashai-boundary-pulse 2s ease-in-out infinite;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;"></div>

                <!-- Corner brackets for alignment -->
                <div style="position:absolute;top:8%;left:20%;width:35px;height:35px;border-left:3px solid #8b5cf6;border-top:3px solid #8b5cf6;border-radius:8px 0 0 0;"></div>
                <div style="position:absolute;top:8%;right:20%;width:35px;height:35px;border-right:3px solid #8b5cf6;border-top:3px solid #8b5cf6;border-radius:0 8px 0 0;"></div>
                <div style="position:absolute;bottom:8%;left:20%;width:35px;height:35px;border-left:3px solid #8b5cf6;border-bottom:3px solid #8b5cf6;border-radius:0 0 0 8px;"></div>
                <div style="position:absolute;bottom:8%;right:20%;width:35px;height:35px;border-right:3px solid #8b5cf6;border-bottom:3px solid #8b5cf6;border-radius:0 0 8px 0;"></div>

                <!-- Center crosshair -->
                <div style="position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);width:50px;height:50px;">
                  <div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:rgba(139,92,246,0.6);"></div>
                  <div style="position:absolute;top:0;left:50%;width:2px;height:100%;background:rgba(139,92,246,0.6);"></div>
                  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;background:rgba(139,92,246,0.8);border-radius:50%;"></div>
                </div>

                <!-- Guide text at bottom -->
                <div style="position:absolute;bottom:5%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:10px 24px;border-radius:25px;font-size:14px;font-weight:600;white-space:nowrap;border:2px solid rgba(139,92,246,0.6);box-shadow:0 4px 15px rgba(0,0,0,0.3);">
                  <span id="flashai-vto-boundary-text">👤 Position your face inside the oval</span>
                </div>
              </div>

              <!-- Photo indicator (top) - NO CLASS to avoid external CSS interference -->
              <div id="flashai-vto-face-angle-indicator" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:500;z-index:15;border:1px solid rgba(255,255,255,0.2);backdrop-filter:none !important;-webkit-backdrop-filter:none !important;box-shadow:none !important;">
                📸 Photo <span id="flashai-vto-face-photo-count">1</span> of 3: <span id="flashai-vto-current-angle">Front View</span>
              </div>

              <!-- Auto-capture countdown overlay -->
              <div id="flashai-vto-countdown-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;display:none;align-items:center;justify-content:center;z-index:20;pointer-events:none;">
                <div style="display:flex;flex-direction:column;align-items:center;">
                  <div id="flashai-vto-countdown-number" style="width:100px;height:100px;border-radius:50%;background:rgba(139,92,246,0.9);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:800;color:#fff;box-shadow:0 0 40px rgba(139,92,246,0.6);animation:flashai-countdown-pulse 1s ease-in-out infinite;">5</div>
                  <p id="flashai-vto-countdown-text" style="margin-top:12px;background:rgba(0,0,0,0.8);color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:600;">Get ready for front photo</p>
                </div>
              </div>
              <style>
                @keyframes flashai-countdown-pulse {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.1); }
                }
                @keyframes flashai-capture-flash {
                  0% { opacity: 0; }
                  50% { opacity: 1; }
                  100% { opacity: 0; }
                }
              </style>
            </div>

            <!-- Lighting Guide -->
            <div class="flashai-vto-quality-indicators" id="flashai-vto-quality-indicators" style="display:flex;justify-content:center;padding:8px 12px;margin:8px 0;">
              <div class="flashai-vto-quality-item" id="flashai-vto-quality-lighting" style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:20px;background:#fef3c7;border:2px solid #f59e0b;transition:all 0.3s;">
                <span style="font-size:16px;">💡</span>
                <div>
                  <span style="font-size:12px;font-weight:600;color:#92400e;">Lighting: </span>
                  <span id="flashai-vto-quality-lighting-status" style="font-size:12px;font-weight:700;color:#92400e;">Checking...</span>
                </div>
              </div>
            </div>

            <div class="flashai-vto-face-photos-preview" id="flashai-vto-face-photos"></div>

            <div class="flashai-vto-actions" style="padding:12px 20px;">
              <button id="flashai-vto-face-capture" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Capture Front View
              </button>
              <button id="flashai-vto-face-analyze" class="flashai-vto-btn-primary" style="display:none;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;width:100%;padding:16px 24px;font-size:16px;font-weight:700;border-radius:12px;border:none;box-shadow:0 4px 15px rgba(139,92,246,0.4);cursor:pointer;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;vertical-align:middle;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
                Analyze My Skin
              </button>
            </div>

            <div class="flashai-vto-instructions">
              <h4>For best results:</h4>
              <ul>
                <li>🎯 Align your face inside the oval boundary</li>
                <li>💡 Ensure good, even lighting</li>
                <li>👀 Look directly at the camera for front view</li>
                <li>↪️ Turn head 45° for profile shots</li>
              </ul>
            </div>
          </div>

          <!-- Face Scan Step 2: Processing -->
          <div id="flashai-vto-step-face-processing" class="flashai-vto-step">
            <div class="flashai-vto-header">
              <h2>Analyzing Your Skin</h2>
              <p>This usually takes 10-15 seconds...</p>
            </div>

            <div class="flashai-vto-loader-container">
              <div class="flashai-vto-loader"></div>
              <div class="flashai-vto-loader-text">Analyzing skin and finding products</div>
            </div>

            <div class="flashai-vto-processing-steps">
              <div class="flashai-vto-processing-step" data-step="1">
                <div class="flashai-vto-step-icon">✓</div>
                <div class="flashai-vto-step-text">Photos uploaded</div>
              </div>
              <div class="flashai-vto-processing-step" data-step="2">
                <div class="flashai-vto-step-icon">⋯</div>
                <div class="flashai-vto-step-text">Analyzing skin tone & texture</div>
              </div>
              <div class="flashai-vto-processing-step" data-step="3">
                <div class="flashai-vto-step-icon">⋯</div>
                <div class="flashai-vto-step-text">Detecting skin concerns</div>
              </div>
              <div class="flashai-vto-processing-step" data-step="4">
                <div class="flashai-vto-step-icon">⋯</div>
                <div class="flashai-vto-step-text">Finding perfect products</div>
              </div>
            </div>
          </div>

          <!-- Face Scan Step 3: Results (Accordion with Zoomed Regions) -->
          <div id="flashai-vto-step-face-results" class="flashai-vto-step">
            <div class="flashai-vto-face-results-content">

              <!-- Header with Score and User Account -->
              <div class="flashai-vto-results-header-row" style="display:flex;align-items:center;gap:16px;padding:12px 16px;background:linear-gradient(135deg,#fafafa 0%,#fff 100%);border-bottom:1px solid #e4e4e7;margin:-20px -20px 0;">
                <div class="flashai-vto-score-mini" style="position:relative;width:56px;height:56px;flex-shrink:0;">
                  <svg viewBox="0 0 80 80" class="flashai-vto-score-ring" style="width:100%;height:100%;">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" stroke-width="6"></circle>
                    <circle id="flashai-vto-score-circle" cx="40" cy="40" r="36" fill="none" stroke="${this.config.primaryColor}" stroke-width="6" stroke-dasharray="226.2" stroke-dashoffset="226.2" stroke-linecap="round" transform="rotate(-90 40 40)"></circle>
                  </svg>
                  <span id="flashai-vto-skin-score" class="flashai-vto-score-number" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:18px;font-weight:800;color:#18181b;">--</span>
                </div>
                <div class="flashai-vto-results-title" style="flex:1;">
                  <h2 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 4px;">Skin Analysis</h2>
                  <p style="font-size:12px;color:#71717a;margin:0;display:flex;align-items:center;gap:6px;">
                    Skin Tone:
                    <span id="flashai-vto-skin-color-swatch" style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid #e5e7eb;background:#DEB887;"></span>
                    <strong id="flashai-vto-skin-tone" style="color:#3f3f46;">--</strong>
                  </p>
                </div>
                <!-- User Account Button -->
                <button id="flashai-vto-account-btn" style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(139,92,246,0.3);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span id="flashai-vto-account-text">Sign In</span>
                </button>
              </div>

              <!-- Navigation Tabs -->
              <div class="flashai-vto-tabs" style="display:flex;gap:0;padding:0 16px;background:#fff;border-bottom:1px solid #e4e4e7;margin:0 -20px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
                <button class="flashai-vto-tab active" data-tab="analysis" style="flex:1;min-width:fit-content;padding:12px 8px;background:none;border:none;border-bottom:2px solid #8b5cf6;color:#8b5cf6;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;">
                  <span style="display:block;">📊</span>Analysis
                </button>
                <button class="flashai-vto-tab" data-tab="progress" style="flex:1;min-width:fit-content;padding:12px 8px;background:none;border:none;border-bottom:2px solid transparent;color:#71717a;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;">
                  <span style="display:block;">📈</span>Progress
                </button>
                <button class="flashai-vto-tab" data-tab="goals" style="flex:1;min-width:fit-content;padding:12px 8px;background:none;border:none;border-bottom:2px solid transparent;color:#71717a;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;">
                  <span style="display:block;">🎯</span>Goals
                </button>
                <button class="flashai-vto-tab" data-tab="routine" style="flex:1;min-width:fit-content;padding:12px 8px;background:none;border:none;border-bottom:2px solid transparent;color:#71717a;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;">
                  <span style="display:block;">✨</span>Routine
                </button>
                <button class="flashai-vto-tab" data-tab="predictions" style="flex:1;min-width:fit-content;padding:12px 8px;background:none;border:none;border-bottom:2px solid transparent;color:#71717a;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;">
                  <span style="display:block;">🔮</span>Predict
                </button>
              </div>

              <!-- Tab Content: Analysis (Default) -->
              <div id="flashai-vto-tab-analysis" class="flashai-vto-tab-content" style="display:block;">

              <!-- Face Image with Severity-Colored Pins -->
              <div class="flashai-vto-analysis-main" style="margin-bottom:20px;">
                <div class="flashai-vto-face-container" id="flashai-vto-face-container" style="position:relative;width:100%;max-width:320px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
                  <img id="flashai-vto-face-image" alt="Your face scan" style="width:100%;height:auto;display:block;" />
                  <canvas id="flashai-vto-highlight-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></canvas>
                  <div id="flashai-vto-pins-container" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                </div>
              </div>

              <!-- Issues List (Accordion Style with Inline Expansion) -->
              <div class="flashai-vto-issues-section" style="margin-bottom:16px;">
                <h3 class="flashai-vto-issues-title" style="font-size:14px;font-weight:700;color:#3f3f46;margin:0 0 12px;">Detected Concerns</h3>
                <div class="flashai-vto-issues-list" id="flashai-vto-issues-list" style="display:flex;flex-direction:column;gap:0;">
                  <!-- Dynamically generated accordion items -->
                </div>
              </div>

              <!-- Treatment Prioritization Section -->
              <div class="flashai-vto-treatment-priority" id="flashai-vto-treatment-priority" style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#fef3c7 0%,#fff7ed 100%);border-radius:12px;border:1px solid #fed7aa;">
                <h3 style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#92400e;margin:0 0 12px;">
                  <span style="font-size:18px;">📋</span> Your Treatment Priority Order
                </h3>
                <p style="font-size:12px;color:#78350f;margin:0 0 12px;">Focus on one concern at a time for best results. Here's your recommended order:</p>
                <div id="flashai-vto-priority-list" style="display:flex;flex-direction:column;gap:8px;">
                  <!-- Dynamically populated -->
                </div>
              </div>

              <!-- 12-Month Skincare Journey Timeline -->
              <div class="flashai-vto-timeline" id="flashai-vto-timeline" style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%);border-radius:12px;border:1px solid #ddd6fe;">
                <h3 style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#5b21b6;margin:0 0 12px;">
                  <span style="font-size:18px;">📅</span> Your 12-Month Skincare Journey
                </h3>
                <div id="flashai-vto-timeline-content" style="display:flex;flex-direction:column;gap:10px;">
                  <!-- Dynamically populated -->
                </div>
              </div>

              <!-- Healthcare Professional Recommendation -->
              <div class="flashai-vto-healthcare-notice" id="flashai-vto-healthcare-notice" style="display:none;margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#fef2f2 0%,#fff 100%);border-radius:12px;border:2px solid #fca5a5;">
                <h3 style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#b91c1c;margin:0 0 8px;">
                  <span style="font-size:18px;">⚕️</span> Professional Consultation Recommended
                </h3>
                <p id="flashai-vto-healthcare-text" style="font-size:13px;color:#7f1d1d;margin:0 0 12px;line-height:1.5;">
                  Based on your scan results, we recommend consulting a dermatologist or healthcare professional for personalized treatment.
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#fee2e2;border-radius:20px;font-size:11px;font-weight:600;color:#991b1b;">
                    🏥 Dermatologist
                  </span>
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#fee2e2;border-radius:20px;font-size:11px;font-weight:600;color:#991b1b;">
                    💊 Prescription Treatment
                  </span>
                </div>
              </div>
              </div><!-- End Tab: Analysis -->

              <!-- Tab Content: Progress -->
              <div id="flashai-vto-tab-progress" class="flashai-vto-tab-content" style="display:none;">
                <div class="flashai-vto-progress-container" style="padding:0;">
                  <!-- Login Prompt for non-authenticated users -->
                  <div id="flashai-vto-progress-login-prompt" style="text-align:center;padding:40px 20px;">
                    <div style="width:80px;height:80px;margin:0 auto 16px;background:linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
                      </svg>
                    </div>
                    <h3 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px;">Track Your Skin Journey</h3>
                    <p style="font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.5;">Sign in to save your scans and track your progress over time</p>
                    <button id="flashai-vto-progress-signin" style="padding:12px 32px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);transition:all 0.2s;">
                      Sign In to Track Progress
                    </button>
                  </div>
                  <!-- Progress Content (shown when logged in) -->
                  <div id="flashai-vto-progress-content" style="display:none;">
                    <!-- Timeline Chart -->
                    <div style="margin-bottom:20px;padding:16px;background:#fff;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:14px;font-weight:700;color:#18181b;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
                        <span>📈</span> Skin Score Over Time
                      </h4>
                      <div id="flashai-vto-score-chart" style="height:150px;background:linear-gradient(180deg,#f5f3ff 0%,#fff 100%);border-radius:8px;display:flex;align-items:flex-end;justify-content:space-around;padding:16px 8px 8px;gap:4px;">
                        <!-- Chart bars populated dynamically -->
                        <div style="text-align:center;color:#71717a;font-size:12px;">Loading...</div>
                      </div>
                    </div>
                    <!-- Recent Scans -->
                    <div style="margin-bottom:20px;">
                      <h4 style="font-size:14px;font-weight:700;color:#18181b;margin:0 0 12px;">Recent Scans</h4>
                      <div id="flashai-vto-recent-scans" style="display:flex;flex-direction:column;gap:8px;">
                        <!-- Populated dynamically -->
                      </div>
                    </div>
                    <!-- Milestones -->
                    <div style="padding:16px;background:linear-gradient(135deg,#fef3c7 0%,#fff7ed 100%);border-radius:12px;border:1px solid #fed7aa;">
                      <h4 style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
                        <span>🏆</span> Milestones
                      </h4>
                      <div id="flashai-vto-milestones" style="display:flex;flex-direction:column;gap:8px;">
                        <!-- Populated dynamically -->
                      </div>
                    </div>
                  </div>
                </div>
              </div><!-- End Tab: Progress -->

              <!-- Tab Content: Goals -->
              <div id="flashai-vto-tab-goals" class="flashai-vto-tab-content" style="display:none;">
                <div class="flashai-vto-goals-container" style="padding:0;">
                  <!-- Login Prompt -->
                  <div id="flashai-vto-goals-login-prompt" style="text-align:center;padding:40px 20px;">
                    <div style="width:80px;height:80px;margin:0 auto 16px;background:linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="6"></circle>
                        <circle cx="12" cy="12" r="2"></circle>
                      </svg>
                    </div>
                    <h3 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px;">Set Your Skin Goals</h3>
                    <p style="font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.5;">Create personalized goals and track your journey to better skin</p>
                    <button id="flashai-vto-goals-signin" style="padding:12px 32px;background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(22,163,74,0.3);transition:all 0.2s;">
                      Sign In to Set Goals
                    </button>
                  </div>
                  <!-- Goals Content -->
                  <div id="flashai-vto-goals-content" style="display:none;">
                    <!-- Active Goals -->
                    <div style="margin-bottom:20px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h4 style="font-size:14px;font-weight:700;color:#18181b;margin:0;">My Goals</h4>
                        <button id="flashai-vto-add-goal" style="padding:6px 12px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:600;color:#3f3f46;cursor:pointer;">+ Add Goal</button>
                      </div>
                      <div id="flashai-vto-active-goals" style="display:flex;flex-direction:column;gap:12px;">
                        <!-- Populated dynamically -->
                      </div>
                    </div>
                    <!-- Goal Templates -->
                    <div style="padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 12px;">Suggested Goals</h4>
                      <div id="flashai-vto-goal-templates" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                        <!-- Populated dynamically -->
                      </div>
                    </div>
                  </div>
                </div>
              </div><!-- End Tab: Goals -->

              <!-- Tab Content: Routine -->
              <div id="flashai-vto-tab-routine" class="flashai-vto-tab-content" style="display:none;">
                <div class="flashai-vto-routine-container" style="padding:0;">
                  <!-- Login Prompt -->
                  <div id="flashai-vto-routine-login-prompt" style="text-align:center;padding:40px 20px;">
                    <div style="width:80px;height:80px;margin:0 auto 16px;background:linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </div>
                    <h3 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px;">Your Personalized Routine</h3>
                    <p style="font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.5;">Get a custom AM/PM skincare routine based on your analysis</p>
                    <button id="flashai-vto-routine-signin" style="padding:12px 32px;background:linear-gradient(135deg,#db2777 0%,#be185d 100%);color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(219,39,119,0.3);transition:all 0.2s;">
                      Sign In for Routine
                    </button>
                  </div>
                  <!-- Routine Content -->
                  <div id="flashai-vto-routine-content" style="display:none;">
                    <!-- AM/PM Toggle -->
                    <div style="display:flex;gap:0;margin-bottom:20px;background:#f4f4f5;border-radius:25px;padding:4px;">
                      <button id="flashai-vto-routine-am" class="active" style="flex:1;padding:10px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:none;border-radius:22px;font-size:13px;font-weight:600;color:#92400e;cursor:pointer;transition:all 0.2s;">
                        ☀️ Morning
                      </button>
                      <button id="flashai-vto-routine-pm" style="flex:1;padding:10px;background:transparent;border:none;border-radius:22px;font-size:13px;font-weight:600;color:#71717a;cursor:pointer;transition:all 0.2s;">
                        🌙 Night
                      </button>
                    </div>
                    <!-- Routine Steps -->
                    <div id="flashai-vto-routine-steps" style="display:flex;flex-direction:column;gap:12px;">
                      <!-- Populated dynamically -->
                    </div>
                    <!-- Generate Routine Button -->
                    <button id="flashai-vto-generate-routine" style="width:100%;margin-top:20px;padding:14px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
                      </svg>
                      Generate My Routine
                    </button>
                  </div>
                </div>
              </div><!-- End Tab: Routine -->

              <!-- Tab Content: Predictions -->
              <div id="flashai-vto-tab-predictions" class="flashai-vto-tab-content" style="display:none;">
                <div class="flashai-vto-predictions-container" style="padding:0;">
                  <!-- Login Prompt -->
                  <div id="flashai-vto-predictions-login-prompt" style="text-align:center;padding:40px 20px;">
                    <div style="width:80px;height:80px;margin:0 auto 16px;background:linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16V12"></path>
                        <path d="M12 8h.01"></path>
                      </svg>
                    </div>
                    <h3 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px;">See Your Future Skin</h3>
                    <p style="font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.5;">Get AI predictions on how your skin will improve over time</p>
                    <button id="flashai-vto-predictions-signin" style="padding:12px 32px;background:linear-gradient(135deg,#4f46e5 0%,#4338ca 100%);color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(79,70,229,0.3);transition:all 0.2s;">
                      Sign In to See Predictions
                    </button>
                  </div>
                  <!-- Predictions Content -->
                  <div id="flashai-vto-predictions-content" style="display:none;">
                    <!-- Timeframe Selector -->
                    <div style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px;">
                      <button class="flashai-vto-timeframe active" data-weeks="4" style="padding:8px 16px;background:#8b5cf6;color:#fff;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">4 Weeks</button>
                      <button class="flashai-vto-timeframe" data-weeks="8" style="padding:8px 16px;background:#f4f4f5;color:#71717a;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">8 Weeks</button>
                      <button class="flashai-vto-timeframe" data-weeks="12" style="padding:8px 16px;background:#f4f4f5;color:#71717a;border:none;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">12 Weeks</button>
                    </div>
                    <!-- Predicted Improvements -->
                    <div style="margin-bottom:20px;">
                      <h4 style="font-size:14px;font-weight:700;color:#18181b;margin:0 0 12px;">Predicted Improvements</h4>
                      <div id="flashai-vto-prediction-bars" style="display:flex;flex-direction:column;gap:12px;">
                        <!-- Populated dynamically -->
                      </div>
                    </div>
                    <!-- Confidence Note -->
                    <div style="padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e4e4e7;">
                      <p style="font-size:11px;color:#71717a;margin:0;line-height:1.5;">
                        <strong>Note:</strong> Predictions are based on your current routine adherence and similar user outcomes. Actual results may vary based on consistency and individual factors.
                      </p>
                    </div>
                  </div>
                </div>
              </div><!-- End Tab: Predictions -->

              <!-- Hidden elements for backward compatibility -->
              <div style="display:none;">
                <div id="flashai-vto-hydration-level"></div>
                <div id="flashai-vto-skin-undertone"></div>
                <div id="flashai-vto-metric-pigmentation"></div>
                <div id="flashai-vto-metric-acne"></div>
                <div id="flashai-vto-metric-wrinkles"></div>
                <div id="flashai-vto-metric-texture"></div>
                <div id="flashai-vto-metric-redness"></div>
                <div id="flashai-vto-metric-hydration"></div>
                <div id="flashai-vto-skin-summary"></div>
                <div id="flashai-vto-summary-concerns"></div>
                <div id="flashai-vto-summary-tips"></div>
                <div id="flashai-vto-detail-icon"></div>
                <div id="flashai-vto-detail-score"></div>
              </div>

            </div>
          </div>

          <!-- Auth Modal -->
          <div id="flashai-vto-auth-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:20px;padding:24px;width:90%;max-width:360px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);">
              <button id="flashai-vto-auth-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;color:#71717a;cursor:pointer;">&times;</button>

              <!-- Auth Tabs -->
              <div style="display:flex;gap:0;margin-bottom:24px;background:#f4f4f5;border-radius:25px;padding:4px;">
                <button id="flashai-vto-auth-signin-tab" class="active" style="flex:1;padding:10px;background:#fff;border:none;border-radius:22px;font-size:13px;font-weight:600;color:#18181b;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);">Sign In</button>
                <button id="flashai-vto-auth-signup-tab" style="flex:1;padding:10px;background:transparent;border:none;border-radius:22px;font-size:13px;font-weight:600;color:#71717a;cursor:pointer;">Sign Up</button>
              </div>

              <!-- Sign In Form -->
              <div id="flashai-vto-signin-form">
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:600;color:#3f3f46;margin-bottom:6px;">Email</label>
                  <input id="flashai-vto-signin-email" type="email" placeholder="you@example.com" style="width:100%;padding:12px 16px;border:1px solid #e4e4e7;border-radius:10px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:20px;">
                  <label style="display:block;font-size:13px;font-weight:600;color:#3f3f46;margin-bottom:6px;">Password</label>
                  <input id="flashai-vto-signin-password" type="password" placeholder="••••••••" style="width:100%;padding:12px 16px;border:1px solid #e4e4e7;border-radius:10px;font-size:14px;box-sizing:border-box;">
                </div>
                <button id="flashai-vto-signin-submit" style="width:100%;padding:14px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">
                  Sign In
                </button>
                <div id="flashai-vto-signin-error" style="display:none;margin-top:12px;padding:10px;background:#fef2f2;border-radius:8px;color:#b91c1c;font-size:12px;text-align:center;"></div>
              </div>

              <!-- Sign Up Form -->
              <div id="flashai-vto-signup-form" style="display:none;">
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:600;color:#3f3f46;margin-bottom:6px;">First Name</label>
                  <input id="flashai-vto-signup-name" type="text" placeholder="Your name" style="width:100%;padding:12px 16px;border:1px solid #e4e4e7;border-radius:10px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:13px;font-weight:600;color:#3f3f46;margin-bottom:6px;">Email</label>
                  <input id="flashai-vto-signup-email" type="email" placeholder="you@example.com" style="width:100%;padding:12px 16px;border:1px solid #e4e4e7;border-radius:10px;font-size:14px;box-sizing:border-box;">
                </div>
                <div style="margin-bottom:20px;">
                  <label style="display:block;font-size:13px;font-weight:600;color:#3f3f46;margin-bottom:6px;">Password</label>
                  <input id="flashai-vto-signup-password" type="password" placeholder="At least 6 characters" style="width:100%;padding:12px 16px;border:1px solid #e4e4e7;border-radius:10px;font-size:14px;box-sizing:border-box;">
                </div>
                <button id="flashai-vto-signup-submit" style="width:100%;padding:14px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">
                  Create Account
                </button>
                <div id="flashai-vto-signup-error" style="display:none;margin-top:12px;padding:10px;background:#fef2f2;border-radius:8px;color:#b91c1c;font-size:12px;text-align:center;"></div>
              </div>

              <p style="margin-top:20px;font-size:11px;color:#a1a1aa;text-align:center;line-height:1.5;">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          <!-- Error State -->
          <div id="flashai-vto-step-error" class="flashai-vto-step" style="display: none;">
            <div class="flashai-vto-error-content">
              <div class="flashai-vto-error-icon">⚠️</div>
              <h2>Oops! Something went wrong</h2>
              <p id="flashai-vto-error-message">Please try again</p>
              <button id="flashai-vto-retry" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                Try Again
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.elements.modal = modal;

      // Attach event listeners
      this.attachModalEvents();
    }

    attachModalEvents() {
      const modal = this.elements.modal;

      // Close button
      modal.querySelector('.flashai-vto-close').addEventListener('click', () => {
        this.closeModal();
      });

      // Overlay click
      modal.querySelector('.flashai-vto-overlay').addEventListener('click', () => {
        this.closeModal();
      });

      // Capture photo button
      modal.querySelector('#flashai-vto-capture').addEventListener('click', () => {
        this.capturePhoto();
      });

      // Process scan button
      modal.querySelector('#flashai-vto-process').addEventListener('click', () => {
        this.processBodyScan();
      });

      // Screenshot button
      modal.querySelector('#flashai-vto-screenshot').addEventListener('click', () => {
        this.takeScreenshot();
      });

      // Share button
      modal.querySelector('#flashai-vto-share').addEventListener('click', () => {
        this.shareSocial();
      });

      // Add to cart button
      modal.querySelector('#flashai-vto-add-to-cart').addEventListener('click', () => {
        this.addToCart();
      });

      // Retry button
      modal.querySelector('#flashai-vto-retry').addEventListener('click', () => {
        this.showStep('scanning');
      });

      // Selection buttons
      modal.querySelector('#flashai-vto-select-tryon').addEventListener('click', () => {
        this.showStep('scanning');
      });

      modal.querySelector('#flashai-vto-select-facescan').addEventListener('click', () => {
        this.showStep('facescan');
      });

      // Face scan buttons
      modal.querySelector('#flashai-vto-face-capture').addEventListener('click', () => {
        this.captureFacePhoto();
      });

      modal.querySelector('#flashai-vto-face-analyze').addEventListener('click', () => {
        this.analyzeFaceScan();
      });

      // ========== NEW: Tab Navigation ==========
      modal.querySelectorAll('.flashai-vto-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const tabName = e.currentTarget.dataset.tab;
          this.switchTab(tabName);
        });
      });

      // ========== NEW: Account Button ==========
      modal.querySelector('#flashai-vto-account-btn').addEventListener('click', () => {
        if (this.state.authToken) {
          this.showAccountMenu();
        } else {
          this.showAuthModal();
        }
      });

      // ========== NEW: Auth Modal Events ==========
      modal.querySelector('#flashai-vto-auth-close')?.addEventListener('click', () => {
        this.hideAuthModal();
      });

      modal.querySelector('#flashai-vto-auth-signin-tab')?.addEventListener('click', () => {
        this.showSignInForm();
      });

      modal.querySelector('#flashai-vto-auth-signup-tab')?.addEventListener('click', () => {
        this.showSignUpForm();
      });

      modal.querySelector('#flashai-vto-signin-submit')?.addEventListener('click', () => {
        this.handleSignIn();
      });

      modal.querySelector('#flashai-vto-signup-submit')?.addEventListener('click', () => {
        this.handleSignUp();
      });

      // ========== NEW: Sign In prompts in tabs ==========
      ['progress', 'goals', 'routine', 'predictions'].forEach(tab => {
        const btn = modal.querySelector(`#flashai-vto-${tab}-signin`);
        if (btn) {
          btn.addEventListener('click', () => this.showAuthModal());
        }
      });

      // ========== NEW: Routine AM/PM Toggle ==========
      modal.querySelector('#flashai-vto-routine-am')?.addEventListener('click', () => {
        this.switchRoutineTime('am');
      });

      modal.querySelector('#flashai-vto-routine-pm')?.addEventListener('click', () => {
        this.switchRoutineTime('pm');
      });

      modal.querySelector('#flashai-vto-generate-routine')?.addEventListener('click', () => {
        this.generateRoutine();
      });

      // ========== NEW: Goals Events ==========
      modal.querySelector('#flashai-vto-add-goal')?.addEventListener('click', () => {
        this.showAddGoalModal();
      });

      // ========== NEW: Prediction Timeframe ==========
      modal.querySelectorAll('.flashai-vto-timeframe').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const weeks = parseInt(e.currentTarget.dataset.weeks);
          this.loadPredictions(weeks);
        });
      });
    }

    // ==========================================================================
    // NEW: Tab Management
    // ==========================================================================

    switchTab(tabName) {
      const modal = this.elements.modal;

      // Update tab buttons
      modal.querySelectorAll('.flashai-vto-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
          tab.classList.add('active');
          tab.style.borderBottomColor = '#8b5cf6';
          tab.style.color = '#8b5cf6';
        } else {
          tab.classList.remove('active');
          tab.style.borderBottomColor = 'transparent';
          tab.style.color = '#71717a';
        }
      });

      // Show/hide tab content
      modal.querySelectorAll('.flashai-vto-tab-content').forEach(content => {
        content.style.display = 'none';
      });

      const tabContent = document.getElementById(`flashai-vto-tab-${tabName}`);
      if (tabContent) {
        tabContent.style.display = 'block';
      }

      // Load data for authenticated tabs
      if (this.state.authToken) {
        if (tabName === 'progress') this.loadProgressData();
        else if (tabName === 'goals') this.loadGoalsData();
        else if (tabName === 'routine') this.loadRoutineData();
        else if (tabName === 'predictions') this.loadPredictions(8);
      }
    }

    // ==========================================================================
    // NEW: Authentication
    // ==========================================================================

    showAuthModal() {
      const authModal = document.getElementById('flashai-vto-auth-modal');
      if (authModal) {
        authModal.style.display = 'flex';
        this.showSignInForm();
      }
    }

    hideAuthModal() {
      const authModal = document.getElementById('flashai-vto-auth-modal');
      if (authModal) {
        authModal.style.display = 'none';
      }
    }

    showSignInForm() {
      const signinForm = document.getElementById('flashai-vto-signin-form');
      const signupForm = document.getElementById('flashai-vto-signup-form');
      const signinTab = document.getElementById('flashai-vto-auth-signin-tab');
      const signupTab = document.getElementById('flashai-vto-auth-signup-tab');

      if (signinForm) signinForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
      if (signinTab) {
        signinTab.style.background = '#fff';
        signinTab.style.color = '#18181b';
        signinTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }
      if (signupTab) {
        signupTab.style.background = 'transparent';
        signupTab.style.color = '#71717a';
        signupTab.style.boxShadow = 'none';
      }
    }

    showSignUpForm() {
      const signinForm = document.getElementById('flashai-vto-signin-form');
      const signupForm = document.getElementById('flashai-vto-signup-form');
      const signinTab = document.getElementById('flashai-vto-auth-signin-tab');
      const signupTab = document.getElementById('flashai-vto-auth-signup-tab');

      if (signinForm) signinForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
      if (signupTab) {
        signupTab.style.background = '#fff';
        signupTab.style.color = '#18181b';
        signupTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }
      if (signinTab) {
        signinTab.style.background = 'transparent';
        signinTab.style.color = '#71717a';
        signinTab.style.boxShadow = 'none';
      }
    }

    async handleSignIn() {
      const email = document.getElementById('flashai-vto-signin-email')?.value;
      const password = document.getElementById('flashai-vto-signin-password')?.value;
      const errorEl = document.getElementById('flashai-vto-signin-error');

      if (!email || !password) {
        if (errorEl) {
          errorEl.textContent = 'Please enter email and password';
          errorEl.style.display = 'block';
        }
        return;
      }

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/auth')}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({ email, password, storeId: this.config.storeId })
        });

        const data = await response.json();

        if (data.success) {
          this.state.authToken = data.data.accessToken;
          this.state.user = data.data.user;
          localStorage.setItem('flashai_auth_token', data.data.accessToken);
          localStorage.setItem('flashai_user', JSON.stringify(data.data.user));
          this.updateAuthUI();
          this.hideAuthModal();
          // Link visitor scans to user
          this.linkVisitorScans();
        } else {
          if (errorEl) {
            errorEl.textContent = data.error?.message || data.message || 'Invalid credentials';
            errorEl.style.display = 'block';
          }
        }
      } catch (error) {
        console.error('Sign in error:', error);
        if (errorEl) {
          errorEl.textContent = 'Connection error. Please try again.';
          errorEl.style.display = 'block';
        }
      }
    }

    async handleSignUp() {
      const name = document.getElementById('flashai-vto-signup-name')?.value;
      const email = document.getElementById('flashai-vto-signup-email')?.value;
      const password = document.getElementById('flashai-vto-signup-password')?.value;
      const errorEl = document.getElementById('flashai-vto-signup-error');

      if (!name || !email || !password) {
        if (errorEl) {
          errorEl.textContent = 'Please fill in all fields';
          errorEl.style.display = 'block';
        }
        return;
      }

      if (password.length < 6) {
        if (errorEl) {
          errorEl.textContent = 'Password must be at least 6 characters';
          errorEl.style.display = 'block';
        }
        return;
      }

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/auth')}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({
            email,
            password,
            firstName: name,
            storeId: this.config.storeId,
            visitorId: this.state.visitorId
          })
        });

        const data = await response.json();

        if (data.success) {
          this.state.authToken = data.data.accessToken;
          this.state.user = data.data.user;
          localStorage.setItem('flashai_auth_token', data.data.accessToken);
          localStorage.setItem('flashai_user', JSON.stringify(data.data.user));
          this.updateAuthUI();
          this.hideAuthModal();
        } else {
          if (errorEl) {
            errorEl.textContent = data.error?.message || data.message || 'Registration failed';
            errorEl.style.display = 'block';
          }
        }
      } catch (error) {
        console.error('Sign up error:', error);
        if (errorEl) {
          errorEl.textContent = 'Connection error. Please try again.';
          errorEl.style.display = 'block';
        }
      }
    }

    async linkVisitorScans() {
      if (!this.state.authToken || !this.state.visitorId) return;

      try {
        await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/auth')}/link-visitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.authToken}`
          },
          body: JSON.stringify({ visitorId: this.state.visitorId })
        });
      } catch (error) {
        console.error('Error linking visitor scans:', error);
      }
    }

    updateAuthUI() {
      const accountBtn = document.getElementById('flashai-vto-account-btn');
      const accountText = document.getElementById('flashai-vto-account-text');

      if (this.state.authToken && this.state.user) {
        if (accountText) {
          accountText.textContent = this.state.user.firstName || 'Account';
        }

        // Show content, hide login prompts
        ['progress', 'goals', 'routine', 'predictions'].forEach(tab => {
          const loginPrompt = document.getElementById(`flashai-vto-${tab}-login-prompt`);
          const content = document.getElementById(`flashai-vto-${tab}-content`);
          if (loginPrompt) loginPrompt.style.display = 'none';
          if (content) content.style.display = 'block';
        });
      } else {
        if (accountText) {
          accountText.textContent = 'Sign In';
        }

        // Show login prompts, hide content
        ['progress', 'goals', 'routine', 'predictions'].forEach(tab => {
          const loginPrompt = document.getElementById(`flashai-vto-${tab}-login-prompt`);
          const content = document.getElementById(`flashai-vto-${tab}-content`);
          if (loginPrompt) loginPrompt.style.display = 'block';
          if (content) content.style.display = 'none';
        });
      }
    }

    showAccountMenu() {
      // Simple logout for now
      if (confirm('Do you want to sign out?')) {
        this.state.authToken = null;
        this.state.user = null;
        localStorage.removeItem('flashai_auth_token');
        localStorage.removeItem('flashai_user');
        this.updateAuthUI();
      }
    }

    checkStoredAuth() {
      const token = localStorage.getItem('flashai_auth_token');
      const user = localStorage.getItem('flashai_user');

      if (token && user) {
        this.state.authToken = token;
        this.state.user = JSON.parse(user);
        this.updateAuthUI();
      }
    }

    // ==========================================================================
    // NEW: Progress Data
    // ==========================================================================

    async loadProgressData() {
      if (!this.state.authToken) return;

      const chartContainer = document.getElementById('flashai-vto-score-chart');
      const scansContainer = document.getElementById('flashai-vto-recent-scans');
      const milestonesContainer = document.getElementById('flashai-vto-milestones');

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/progress')}/timeline?days=90`, {
          headers: { 'Authorization': `Bearer ${this.state.authToken}` }
        });

        const data = await response.json();

        if (data.success && data.data.timeline) {
          this.renderProgressChart(data.data.timeline, chartContainer);
          this.renderRecentScans(data.data.timeline.slice(0, 5), scansContainer);
        }

        // Load milestones
        const milestonesRes = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/progress')}/milestones`, {
          headers: { 'Authorization': `Bearer ${this.state.authToken}` }
        });

        const milestonesData = await milestonesRes.json();
        if (milestonesData.success) {
          this.renderMilestones(milestonesData.data.milestones, milestonesContainer);
        }
      } catch (error) {
        console.error('Error loading progress:', error);
        if (chartContainer) {
          chartContainer.innerHTML = '<div style="text-align:center;color:#71717a;font-size:12px;padding:20px;">Unable to load progress data</div>';
        }
      }
    }

    renderProgressChart(timeline, container) {
      if (!container || !timeline || timeline.length === 0) {
        if (container) {
          container.innerHTML = '<div style="text-align:center;color:#71717a;font-size:12px;padding:40px 20px;">Complete more scans to see your progress chart</div>';
        }
        return;
      }

      const maxScore = Math.max(...timeline.map(t => t.skin_score || 0), 100);
      const barWidth = Math.max(20, Math.min(40, (container.clientWidth - 40) / timeline.length - 4));

      container.innerHTML = timeline.slice(-10).map((item, i) => {
        const score = item.skin_score || 0;
        const height = Math.max(10, (score / maxScore) * 100);
        const date = new Date(item.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return `
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:10px;font-weight:600;color:#8b5cf6;">${score}</div>
            <div style="width:${barWidth}px;height:${height}px;background:linear-gradient(180deg,#8b5cf6 0%,#a78bfa 100%);border-radius:4px 4px 0 0;transition:height 0.3s;"></div>
            <div style="font-size:9px;color:#a1a1aa;">${date}</div>
          </div>
        `;
      }).join('');
    }

    renderRecentScans(scans, container) {
      if (!container) return;

      if (!scans || scans.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#71717a;font-size:12px;padding:20px;">No scans yet</div>';
        return;
      }

      container.innerHTML = scans.map(scan => {
        const date = new Date(scan.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const score = scan.skin_score || '--';
        const change = scan.changes?.skin_score || 0;
        const changeColor = change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#71717a';
        const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '→';

        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border:1px solid #e4e4e7;border-radius:10px;">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#8b5cf6;">${score}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:#18181b;">${date}</div>
              <div style="font-size:11px;color:${changeColor};font-weight:500;">${changeIcon} ${Math.abs(change)} points</div>
            </div>
          </div>
        `;
      }).join('');
    }

    renderMilestones(milestones, container) {
      if (!container) return;

      if (!milestones || milestones.length === 0) {
        container.innerHTML = '<div style="font-size:12px;color:#78350f;">Keep scanning to unlock milestones!</div>';
        return;
      }

      container.innerHTML = milestones.map(m => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border-radius:8px;">
          <span style="font-size:20px;">${m.achieved_at ? '🏆' : '🔒'}</span>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:#92400e;">${m.title}</div>
            <div style="font-size:10px;color:#a16207;">${m.description}</div>
          </div>
        </div>
      `).join('');
    }

    // ==========================================================================
    // NEW: Goals Data
    // ==========================================================================

    async loadGoalsData() {
      if (!this.state.authToken) return;

      const goalsContainer = document.getElementById('flashai-vto-active-goals');
      const templatesContainer = document.getElementById('flashai-vto-goal-templates');

      try {
        // Load user goals
        const goalsRes = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/goals')}`, {
          headers: { 'Authorization': `Bearer ${this.state.authToken}` }
        });

        const goalsData = await goalsRes.json();
        if (goalsData.success) {
          this.renderGoals(goalsData.data.goals, goalsContainer);
        }

        // Load templates
        const templatesRes = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/goals')}/templates`, {
          headers: { 'Authorization': `Bearer ${this.state.authToken}` }
        });

        const templatesData = await templatesRes.json();
        if (templatesData.success) {
          this.renderGoalTemplates(templatesData.data.templates, templatesContainer);
        }
      } catch (error) {
        console.error('Error loading goals:', error);
      }
    }

    renderGoals(goals, container) {
      if (!container) return;

      if (!goals || goals.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#71717a;font-size:13px;">No goals yet. Add a goal to get started!</div>';
        return;
      }

      container.innerHTML = goals.map(goal => {
        const progress = Math.min(100, Math.max(0, goal.progress_percent || 0));
        const statusColor = goal.status === 'completed' ? '#16a34a' : goal.status === 'active' ? '#8b5cf6' : '#71717a';

        return `
          <div style="padding:16px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
              <div>
                <h5 style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 4px;">${goal.name || goal.goal_type}</h5>
                <p style="font-size:11px;color:#71717a;margin:0;">${goal.target_date ? `Target: ${new Date(goal.target_date).toLocaleDateString()}` : ''}</p>
              </div>
              <span style="padding:4px 10px;background:${statusColor}20;color:${statusColor};font-size:10px;font-weight:600;border-radius:12px;text-transform:capitalize;">${goal.status}</span>
            </div>
            <div style="background:#f4f4f5;border-radius:6px;height:8px;overflow:hidden;">
              <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#8b5cf6 0%,#7c3aed 100%);border-radius:6px;transition:width 0.3s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;">
              <span style="font-size:11px;color:#71717a;">Current: ${goal.current_value || 0}</span>
              <span style="font-size:11px;font-weight:600;color:#8b5cf6;">${progress}%</span>
              <span style="font-size:11px;color:#71717a;">Target: ${goal.target_value || 100}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    renderGoalTemplates(templates, container) {
      if (!container || !templates) return;

      container.innerHTML = templates.map(t => `
        <button class="flashai-goal-template" data-template-id="${t.id}" style="padding:12px;background:#fff;border:1px solid #e4e4e7;border-radius:10px;text-align:left;cursor:pointer;transition:all 0.2s;">
          <div style="font-size:13px;font-weight:600;color:#18181b;margin-bottom:4px;">${t.name}</div>
          <div style="font-size:10px;color:#71717a;">${t.typical_duration_weeks} weeks</div>
        </button>
      `).join('');

      // Add click handlers
      container.querySelectorAll('.flashai-goal-template').forEach(btn => {
        btn.addEventListener('click', () => {
          const templateId = btn.dataset.templateId;
          this.createGoalFromTemplate(templateId);
        });
      });
    }

    async createGoalFromTemplate(templateId) {
      if (!this.state.authToken) return;

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/goals')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.authToken}`
          },
          body: JSON.stringify({ templateId })
        });

        const data = await response.json();
        if (data.success) {
          this.loadGoalsData();
        }
      } catch (error) {
        console.error('Error creating goal:', error);
      }
    }

    showAddGoalModal() {
      // For now, just show the templates section more prominently
      alert('Select a goal template below to get started!');
    }

    // ==========================================================================
    // NEW: Routine Data
    // ==========================================================================

    async loadRoutineData() {
      if (!this.state.authToken) return;

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines')}`, {
          headers: { 'Authorization': `Bearer ${this.state.authToken}` }
        });

        const data = await response.json();
        if (data.success && data.data.routines) {
          this.state.routines = data.data.routines;
          this.renderRoutine('am');
        } else {
          this.renderEmptyRoutine();
        }
      } catch (error) {
        console.error('Error loading routines:', error);
        this.renderEmptyRoutine();
      }
    }

    switchRoutineTime(time) {
      const amBtn = document.getElementById('flashai-vto-routine-am');
      const pmBtn = document.getElementById('flashai-vto-routine-pm');

      if (time === 'am') {
        amBtn.style.background = 'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)';
        amBtn.style.color = '#92400e';
        pmBtn.style.background = 'transparent';
        pmBtn.style.color = '#71717a';
      } else {
        pmBtn.style.background = 'linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%)';
        pmBtn.style.color = '#4338ca';
        amBtn.style.background = 'transparent';
        amBtn.style.color = '#71717a';
      }

      this.renderRoutine(time);
    }

    renderRoutine(time) {
      const container = document.getElementById('flashai-vto-routine-steps');
      if (!container) return;

      const routine = this.state.routines?.find(r => r.routine_type === time);

      if (!routine || !routine.steps || routine.steps.length === 0) {
        this.renderEmptyRoutine();
        return;
      }

      container.innerHTML = routine.steps.map((step, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;">
          <div style="width:32px;height:32px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;">${i + 1}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:#18181b;text-transform:capitalize;">${step.step_type.replace(/_/g, ' ')}</div>
            ${step.instructions ? `<div style="font-size:11px;color:#71717a;margin-top:2px;">${step.instructions}</div>` : ''}
          </div>
          <button class="flashai-routine-check" data-step-id="${step.id}" style="width:28px;height:28px;background:#f4f4f5;border:2px solid #e4e4e7;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
      `).join('');
    }

    renderEmptyRoutine() {
      const container = document.getElementById('flashai-vto-routine-steps');
      if (!container) return;

      container.innerHTML = `
        <div style="text-align:center;padding:30px 20px;color:#71717a;">
          <div style="font-size:32px;margin-bottom:12px;">✨</div>
          <div style="font-size:14px;font-weight:500;">No routine yet</div>
          <div style="font-size:12px;margin-top:4px;">Click "Generate My Routine" to get started</div>
        </div>
      `;
    }

    async generateRoutine() {
      if (!this.state.authToken) return;

      const btn = document.getElementById('flashai-vto-generate-routine');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div style="width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:flashai-spin 1s linear infinite;"></div> Generating...';
      }

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines')}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.authToken}`
          }
        });

        const data = await response.json();
        if (data.success) {
          this.loadRoutineData();
        }
      } catch (error) {
        console.error('Error generating routine:', error);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg> Generate My Routine';
        }
      }
    }

    // ==========================================================================
    // NEW: Predictions
    // ==========================================================================

    async loadPredictions(weeks = 8) {
      if (!this.state.authToken) return;

      // Update timeframe buttons
      document.querySelectorAll('.flashai-vto-timeframe').forEach(btn => {
        if (parseInt(btn.dataset.weeks) === weeks) {
          btn.style.background = '#8b5cf6';
          btn.style.color = '#fff';
        } else {
          btn.style.background = '#f4f4f5';
          btn.style.color = '#71717a';
        }
      });

      const container = document.getElementById('flashai-vto-prediction-bars');
      if (!container) return;

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/predictions')}/summary`, {
          headers: { 'Authorization': `Bearer ${this.state.authToken}` }
        });

        const data = await response.json();
        if (data.success && data.data.metrics) {
          this.renderPredictionBars(data.data.metrics, weeks, container);
        } else {
          container.innerHTML = '<div style="text-align:center;color:#71717a;font-size:12px;padding:20px;">Complete more scans to see predictions</div>';
        }
      } catch (error) {
        console.error('Error loading predictions:', error);
        container.innerHTML = '<div style="text-align:center;color:#71717a;font-size:12px;padding:20px;">Unable to load predictions</div>';
      }
    }

    renderPredictionBars(metrics, weeks, container) {
      if (!container) return;

      const metricLabels = {
        skin_score: { label: 'Overall Skin Health', icon: '✨' },
        acne_score: { label: 'Acne Reduction', icon: '🎯' },
        hydration_score: { label: 'Hydration Level', icon: '💧' },
        wrinkle_score: { label: 'Fine Lines', icon: '🌟' },
        pigmentation_score: { label: 'Even Skin Tone', icon: '🌈' }
      };

      container.innerHTML = Object.entries(metrics).map(([key, value]) => {
        const meta = metricLabels[key] || { label: key, icon: '📊' };
        const current = value.current || 50;
        const predicted = Math.min(100, current + (value.improvement_rate || 2) * weeks);
        const improvement = Math.round(predicted - current);

        return `
          <div style="padding:14px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:18px;">${meta.icon}</span>
                <span style="font-size:13px;font-weight:600;color:#18181b;">${meta.label}</span>
              </div>
              <span style="padding:4px 10px;background:#dcfce7;color:#16a34a;font-size:11px;font-weight:600;border-radius:12px;">+${improvement}%</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:#71717a;width:40px;">${current}</span>
              <div style="flex:1;background:#f4f4f5;border-radius:6px;height:10px;overflow:hidden;position:relative;">
                <div style="width:${current}%;height:100%;background:#d1d5db;border-radius:6px;"></div>
                <div style="position:absolute;top:0;left:0;width:${predicted}%;height:100%;background:linear-gradient(90deg,#8b5cf6 ${(current/predicted)*100}%,#22c55e 100%);border-radius:6px;opacity:0.8;"></div>
              </div>
              <span style="font-size:11px;font-weight:600;color:#16a34a;width:40px;text-align:right;">${Math.round(predicted)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // ==========================================================================
    // Step Management
    // ==========================================================================

    showStep(step) {
      this.state.currentStep = step;

      const steps = this.elements.modal.querySelectorAll('.flashai-vto-step');
      steps.forEach(s => s.style.display = 'none');

      const stepMap = {
        selection: 'flashai-vto-step-selection',
        scanning: 'flashai-vto-step-scanning',
        processing: 'flashai-vto-step-processing',
        tryon: 'flashai-vto-step-tryon',
        facescan: 'flashai-vto-step-facescan',
        'face-processing': 'flashai-vto-step-face-processing',
        'face-results': 'flashai-vto-step-face-results',
        error: 'flashai-vto-step-error',
      };

      const stepElement = document.getElementById(stepMap[step]);
      if (stepElement) {
        stepElement.style.display = 'block';
      }

      // Initialize step-specific functionality
      if (step === 'scanning') {
        this.startCamera();
      } else if (step === 'tryon') {
        this.initializeTryOn();
      } else if (step === 'facescan') {
        this.startFaceCamera();
      }
    }

    // ==========================================================================
    // Camera & Body Scanning
    // ==========================================================================

    async startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        const video = document.getElementById('flashai-vto-camera');
        video.srcObject = stream;
        this.state.cameraStream = stream;

        // Show camera guide
        this.showCameraGuide();
      } catch (error) {
        console.error('Camera access error:', error);
        this.showError('Camera access denied. Please allow camera access to use Virtual Try-On.');
      }
    }

    stopCamera() {
      if (this.state.cameraStream) {
        this.state.cameraStream.getTracks().forEach(track => track.stop());
        this.state.cameraStream = null;
      }
    }

    showCameraGuide() {
      // Simple guide animation
      const guide = document.getElementById('flashai-vto-camera-guide');
      if (guide) {
        setTimeout(() => {
          guide.style.opacity = '0.7';
        }, 500);
      }
    }

    capturePhoto() {
      const video = document.getElementById('flashai-vto-camera');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(blob => {
        this.state.photos.push(blob);

        // Show thumbnail
        const photosContainer = document.getElementById('flashai-vto-photos');
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.className = 'flashai-vto-photo-thumb';
        photosContainer.appendChild(img);

        // Update process button
        const processBtn = document.getElementById('flashai-vto-process');
        processBtn.textContent = `Process Scan (${this.state.photos.length}/3)`;

        // Show process button after 3 photos
        if (this.state.photos.length >= 3) {
          processBtn.style.display = 'block';
        }
      }, 'image/jpeg', 0.9);
    }

    async processBodyScan() {
      if (this.state.photos.length < 3) {
        alert('Please capture at least 3 photos');
        return;
      }

      // Stop camera
      this.stopCamera();

      // Show processing step
      this.showStep('processing');

      // Simulate progress
      this.simulateProgress();

      try {
        // Upload photos
        const formData = new FormData();
        this.state.photos.forEach((photo, i) => {
          formData.append('images', photo, `photo${i}.jpg`);
        });
        formData.append('visitorId', this.state.visitorId);

        const response = await fetch(`${this.config.apiBaseUrl}/body-scan`, {
          method: 'POST',
          headers: {
            'X-API-Key': this.config.apiKey
          },
          body: formData
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to upload body scan');
        }

        this.state.bodyScan = data.data;

        // Poll for completion
        this.pollBodyScanStatus(data.data.scanId);
      } catch (error) {
        console.error('Process body scan error:', error);
        this.showError(error.message || 'Failed to process body scan. Please try again.');
      }
    }

    simulateProgress() {
      let progress = 0;
      const progressBar = document.getElementById('flashai-vto-progress');
      const progressText = document.getElementById('flashai-vto-progress-text');

      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress > 90) progress = 90; // Cap at 90% until actually complete

        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;

        // Update processing steps
        if (progress > 20) this.updateProcessingStep(2, 'active');
        if (progress > 50) this.updateProcessingStep(3, 'active');
        if (progress > 80) this.updateProcessingStep(4, 'active');
      }, 500);

      this.progressInterval = interval;
    }

    updateProcessingStep(step, status) {
      const stepElement = document.querySelector(`.flashai-vto-processing-step[data-step="${step}"]`);
      if (!stepElement) return;

      const icon = stepElement.querySelector('.flashai-vto-step-icon');

      if (status === 'active') {
        stepElement.classList.add('active');
        icon.textContent = '⋯';
      } else if (status === 'complete') {
        stepElement.classList.add('complete');
        stepElement.classList.remove('active');
        icon.textContent = '✓';
      }
    }

    async pollBodyScanStatus(scanId) {
      this.pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${this.config.apiBaseUrl}/body-scan/${scanId}`, {
            headers: {
              'X-API-Key': this.config.apiKey
            }
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to get scan status');
          }

          const scan = data.data;

          if (scan.status === 'completed') {
            clearInterval(this.pollInterval);
            clearInterval(this.progressInterval);

            // Complete all steps
            this.updateProcessingStep(2, 'complete');
            this.updateProcessingStep(3, 'complete');
            this.updateProcessingStep(4, 'complete');

            // Set progress to 100%
            document.getElementById('flashai-vto-progress').style.width = '100%';
            document.getElementById('flashai-vto-progress-text').textContent = '100%';

            // Wait a bit for user to see completion
            setTimeout(() => {
              this.state.bodyScan = data.data;
              this.showStep('tryon');
            }, 1000);
          } else if (scan.status === 'failed') {
            clearInterval(this.pollInterval);
            clearInterval(this.progressInterval);
            this.showError(scan.error_message || 'Body scan failed. Please try again.');
          }
        } catch (error) {
          console.error('Poll error:', error);
          clearInterval(this.pollInterval);
          clearInterval(this.progressInterval);
          this.showError(error.message);
        }
      }, 2000);
    }

    // ==========================================================================
    // Face Scan & Skin Analysis
    // ==========================================================================

    async startFaceCamera() {
      try {
        // Show loading overlay while waiting for camera
        const loadingOverlay = document.getElementById('flashai-vto-camera-loading');
        if (loadingOverlay) {
          loadingOverlay.style.display = 'flex';
          loadingOverlay.style.opacity = '1';
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        const video = document.getElementById('flashai-vto-face-camera');
        video.srcObject = stream;
        this.state.faceCameraStream = stream;

        // Reset state for 3-angle capture
        this.state.facePhotos = [];
        this.state.currentAngleIndex = 0;
        this.state.faceAngles = ['Front View', 'Left Profile', 'Right Profile'];
        this.state.qualityCheckReady = false;

        const analyzeBtn = document.getElementById('flashai-vto-face-analyze');
        if (analyzeBtn) analyzeBtn.style.display = 'none';

        // Clear previous photos
        const photosContainer = document.getElementById('flashai-vto-face-photos');
        if (photosContainer) photosContainer.innerHTML = '';

        // Forcibly remove any blur/frosted effects from all camera elements
        const removeBlurEffects = () => {
          const cameraContainer = document.querySelector('.flashai-vto-camera-container');
          if (cameraContainer) {
            const allElements = cameraContainer.querySelectorAll('*');
            allElements.forEach(el => {
              el.style.backdropFilter = 'none';
              el.style.webkitBackdropFilter = 'none';
              el.style.filter = 'none';
              el.style.webkitFilter = 'none';
            });
            console.log('[Flash AI Widget] Removed blur effects from', allElements.length, 'elements');
          }
        };

        // Hide loading overlay and show video once it's actually playing
        const hideLoadingAndShowVideo = () => {
          console.log('[Flash AI Widget] Camera stream started, hiding loading overlay');
          if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
              loadingOverlay.style.display = 'none';
            }, 300);
          }
          video.style.opacity = '1';
          // Remove any blur effects after video is shown
          setTimeout(removeBlurEffects, 100);
        };

        // Listen for when video actually has frames to display
        video.addEventListener('playing', () => {
          hideLoadingAndShowVideo();
          // Start auto-capture countdown after camera is ready (1 second delay to let user see themselves)
          setTimeout(() => this.startAutoCaptureCountdown(), 1000);
        }, { once: true });

        // Fallback: if playing event doesn't fire within 2 seconds, show video anyway
        setTimeout(() => {
          if (loadingOverlay && loadingOverlay.style.display !== 'none') {
            console.log('[Flash AI Widget] Fallback: showing video after timeout');
            hideLoadingAndShowVideo();
            // Start auto-capture countdown
            setTimeout(() => this.startAutoCaptureCountdown(), 1000);
          }
        }, 2000);

        // Initialize face detection and quality checking
        video.addEventListener('loadedmetadata', () => {
          this.initializeFaceDetection();
        });
      } catch (error) {
        console.error('Face camera access error:', error);
        // Hide loading overlay on error
        const loadingOverlay = document.getElementById('flashai-vto-camera-loading');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        this.showError('Camera access denied. Please allow camera access to use Face Scan.');
      }
    }

    async initializeFaceDetection() {
      const video = document.getElementById('flashai-vto-face-camera');
      if (!video) return;

      // Check if FaceDetector API is available (Chrome/Edge)
      if ('FaceDetector' in window) {
        try {
          this.faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          console.log('[Quality Check] Using FaceDetector API');
        } catch (e) {
          console.log('[Quality Check] FaceDetector API not available, using fallback');
          this.faceDetector = null;
        }
      }

      // Create canvas for frame analysis
      this.qualityCanvas = document.createElement('canvas');
      this.qualityCtx = this.qualityCanvas.getContext('2d', { willReadFrequently: true });

      // Start quality check loop
      this.state.qualityCheckReady = true;
      this.startQualityCheckLoop();
    }

    startQualityCheckLoop() {
      if (this.qualityCheckInterval) {
        clearInterval(this.qualityCheckInterval);
      }

      // Check quality every 200ms
      this.qualityCheckInterval = setInterval(() => {
        if (this.state.faceCameraStream && this.state.qualityCheckReady) {
          this.checkFrameQuality();
        }
      }, 200);
    }

    async checkFrameQuality() {
      const video = document.getElementById('flashai-vto-face-camera');
      if (!video || video.readyState !== 4) return;

      // Draw current frame to canvas
      this.qualityCanvas.width = video.videoWidth;
      this.qualityCanvas.height = video.videoHeight;
      this.qualityCtx.drawImage(video, 0, 0);

      // Get image data for analysis
      const imageData = this.qualityCtx.getImageData(0, 0, this.qualityCanvas.width, this.qualityCanvas.height);

      // Only check lighting (the only reliable indicator without ML face detection)
      const lighting = this.checkLighting(imageData);

      // Update lighting indicator
      this.updateLightingIndicator(lighting);

      // Store for reference (but don't block capture)
      this.state.currentQuality = { lighting };
    }

    checkLighting(imageData) {
      const data = imageData.data;
      let totalBrightness = 0;
      let pixelCount = 0;

      // Sample every 10th pixel for performance
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Calculate perceived brightness
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        totalBrightness += brightness;
        pixelCount++;
      }

      const avgBrightness = totalBrightness / pixelCount;

      // Determine lighting quality with more lenient thresholds
      let status, label;
      if (avgBrightness >= 70 && avgBrightness <= 200) {
        status = 'good';
        label = 'Good';
      } else if (avgBrightness >= 40 && avgBrightness <= 220) {
        status = 'ok';
        label = 'Ok';
      } else if (avgBrightness < 40) {
        status = 'bad';
        label = 'Too Dark';
      } else {
        status = 'bad';
        label = 'Too Bright';
      }

      return { status, label, brightness: avgBrightness };
    }

    updateLightingIndicator(result) {
      const container = document.getElementById('flashai-vto-quality-lighting');
      const statusEl = document.getElementById('flashai-vto-quality-lighting-status');

      if (!container || !statusEl) return;

      // Define colors for each status
      const colors = {
        good: { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
        ok: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        bad: { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' }
      };

      const color = colors[result.status] || colors.ok;

      container.style.background = color.bg;
      container.style.borderColor = color.border;

      // Update all text colors in the container
      container.querySelectorAll('span').forEach(span => {
        span.style.color = color.text;
      });
      statusEl.textContent = result.label;
    }

    stopFaceCamera() {
      if (this.state.faceCameraStream) {
        this.state.faceCameraStream.getTracks().forEach(track => track.stop());
        this.state.faceCameraStream = null;
      }

      // Stop quality check loop
      if (this.qualityCheckInterval) {
        clearInterval(this.qualityCheckInterval);
        this.qualityCheckInterval = null;
      }
      this.state.qualityCheckReady = false;

      // Stop any running countdown
      this.stopAutoCaptureCountdown();
    }

    // ==========================================================================
    // Auto-Capture Countdown System
    // ==========================================================================

    startAutoCaptureCountdown() {
      // Determine countdown duration based on current angle
      // Front view: 5 seconds, Profile views: 3 seconds
      const isFrontView = this.state.currentAngleIndex === 0;
      const countdownDuration = isFrontView ? 5 : 3;

      const overlay = document.getElementById('flashai-vto-countdown-overlay');
      const numberEl = document.getElementById('flashai-vto-countdown-number');
      const textEl = document.getElementById('flashai-vto-countdown-text');

      if (!overlay || !numberEl || !textEl) return;

      // Update text based on current angle
      const angleTexts = [
        'Get ready for front photo',
        'Turn LEFT - profile photo',
        'Turn RIGHT - profile photo'
      ];
      textEl.textContent = angleTexts[this.state.currentAngleIndex] || 'Get ready';

      // Show countdown overlay
      overlay.style.display = 'flex';
      numberEl.textContent = countdownDuration;

      let remaining = countdownDuration;

      // Clear any existing countdown
      if (this.autoCaptureCountdownInterval) {
        clearInterval(this.autoCaptureCountdownInterval);
      }

      console.log(`[Auto-Capture] Starting ${countdownDuration}s countdown for ${this.state.faceAngles[this.state.currentAngleIndex]}`);

      this.autoCaptureCountdownInterval = setInterval(() => {
        remaining--;

        if (remaining > 0) {
          numberEl.textContent = remaining;
          // Add pulse effect
          numberEl.style.animation = 'none';
          setTimeout(() => {
            numberEl.style.animation = 'flashai-countdown-pulse 1s ease-in-out infinite';
          }, 10);
        } else {
          // Countdown complete - capture photo
          clearInterval(this.autoCaptureCountdownInterval);
          this.autoCaptureCountdownInterval = null;

          // Flash effect
          numberEl.textContent = '📸';
          numberEl.style.background = 'rgba(34, 197, 94, 0.9)';
          numberEl.style.boxShadow = '0 0 60px rgba(34, 197, 94, 0.8)';

          setTimeout(() => {
            overlay.style.display = 'none';
            numberEl.style.background = 'rgba(139, 92, 246, 0.9)';
            numberEl.style.boxShadow = '0 0 40px rgba(139, 92, 246, 0.6)';

            // Trigger photo capture
            this.captureFacePhoto();

            // If more photos needed, start next countdown after a brief delay
            if (this.state.currentAngleIndex < 3 && this.state.faceCameraStream) {
              setTimeout(() => {
                if (this.state.faceCameraStream && this.state.currentAngleIndex < 3) {
                  this.startAutoCaptureCountdown();
                }
              }, 800);
            }
          }, 300);
        }
      }, 1000);
    }

    stopAutoCaptureCountdown() {
      if (this.autoCaptureCountdownInterval) {
        clearInterval(this.autoCaptureCountdownInterval);
        this.autoCaptureCountdownInterval = null;
      }

      const overlay = document.getElementById('flashai-vto-countdown-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
    }

    captureFacePhoto() {
      const video = document.getElementById('flashai-vto-face-camera');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Store ALL photos for multi-view display
      const viewNames = ['front', 'left', 'right'];
      const currentView = viewNames[this.state.facePhotos.length] || 'front';
      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      // Initialize multi-view storage if needed
      if (!this.state.faceImagesByView) {
        this.state.faceImagesByView = {};
      }

      // Store image by view name
      this.state.faceImagesByView[currentView] = imageData;

      // Store first photo (front view) as default display image
      if (this.state.facePhotos.length === 0) {
        this.state.faceImageData = imageData;
        this.state.currentFaceView = 'front';
      }

      console.log(`[Face Scan] Captured ${currentView} view image`);

      canvas.toBlob(blob => {
        // Add photo to array
        this.state.facePhotos.push(blob);

        // Show thumbnail
        const photosContainer = document.getElementById('flashai-vto-face-photos');
        if (photosContainer) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.className = 'flashai-vto-photo-thumb';
          photosContainer.appendChild(img);
        }

        // Move to next angle
        this.state.currentAngleIndex++;

        // Update UI based on progress
        if (this.state.currentAngleIndex < 3) {
          // Update for next angle
          const captureBtn = document.getElementById('flashai-vto-face-capture');
          const angleText = document.getElementById('flashai-vto-current-angle');
          const photoCount = document.getElementById('flashai-vto-face-photo-count');
          const boundaryText = document.getElementById('flashai-vto-boundary-text');

          const nextAngle = this.state.faceAngles[this.state.currentAngleIndex];

          if (captureBtn) {
            const angleActions = ['Capture Front View', 'Capture Left Profile', 'Capture Right Profile'];
            captureBtn.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              ${angleActions[this.state.currentAngleIndex]}
            `;
          }

          if (angleText) angleText.textContent = nextAngle;
          if (photoCount) photoCount.textContent = this.state.currentAngleIndex + 1;

          // Update boundary guide text for the next angle
          if (boundaryText) {
            const boundaryGuides = [
              'Position your face inside the oval',
              '⬅️ Turn head LEFT - show left profile',
              '➡️ Turn head RIGHT - show right profile'
            ];
            boundaryText.textContent = boundaryGuides[this.state.currentAngleIndex];
          }
        } else {
          // All photos captured, show analyze button
          const captureBtn = document.getElementById('flashai-vto-face-capture');
          const analyzeBtn = document.getElementById('flashai-vto-face-analyze');
          const boundary = document.getElementById('flashai-vto-face-boundary');

          if (captureBtn) captureBtn.style.display = 'none';
          if (analyzeBtn) analyzeBtn.style.display = 'block';
          if (boundary) boundary.style.display = 'none'; // Hide boundary when done

          // Stop camera
          this.stopFaceCamera();
        }

        // Flash effect to show capture
        const indicator = document.getElementById('flashai-vto-face-angle-indicator');
        if (indicator) {
          indicator.style.opacity = '0';
          setTimeout(() => { indicator.style.opacity = '1'; }, 200);
        }
      }, 'image/jpeg', 0.95);
    }

    async analyzeFaceScan() {
      if (!this.state.facePhotos || this.state.facePhotos.length < 3) {
        alert('Please capture all 3 photos first');
        return;
      }

      // Stop camera if still running
      this.stopFaceCamera();

      // Show processing step
      this.showStep('face-processing');

      try {
        // Upload face scan with all 3 angles
        const formData = new FormData();
        formData.append('images', this.state.facePhotos[0], 'face-front.jpg');
        formData.append('images', this.state.facePhotos[1], 'face-left.jpg');
        formData.append('images', this.state.facePhotos[2], 'face-right.jpg');
        formData.append('visitorId', this.state.visitorId);

        // Face scan uses /api/face-scan instead of /api/vto
        const faceScanBaseUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/face-scan');
        const uploadUrl = `${faceScanBaseUrl}/upload`;

        console.log('[Face Scan] Uploading to:', uploadUrl);
        console.log('[Face Scan] Photos:', this.state.facePhotos.length);
        console.log('[Face Scan] Visitor ID:', this.state.visitorId);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'X-API-Key': this.config.apiKey
          },
          body: formData
        });

        console.log('[Face Scan] Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Face Scan] Error response:', response.status, errorText);

          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: 'Network error', details: errorText };
          }

          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[Face Scan] Upload response:', JSON.stringify(data, null, 2));

        if (!data.success) {
          throw new Error(data.error || 'Failed to upload face scan');
        }

        const scanId = data.data?.scanId || data.scanId;
        console.log('[Face Scan] Extracted scanId:', scanId);

        if (!scanId) {
          console.error('[Face Scan] No scanId in response!', data);
          throw new Error('No scan ID returned from server');
        }

        this.state.faceScanId = scanId;

        // Start progress animation
        this.animateFaceScanProgress();

        // Poll for results
        this.pollFaceScanStatus(scanId);
      } catch (error) {
        console.error('Analyze face scan error:', error);
        this.showError(error.message || 'Failed to analyze face scan. Please try again.');
      }
    }

    animateFaceScanProgress() {
      // Animate processing steps sequentially
      setTimeout(() => {
        this.updateFaceScanStep(1, 'complete');
        this.updateFaceScanStep(2, 'active');
      }, 500);

      setTimeout(() => {
        this.updateFaceScanStep(2, 'complete');
        this.updateFaceScanStep(3, 'active');
      }, 3000);

      setTimeout(() => {
        this.updateFaceScanStep(3, 'complete');
        this.updateFaceScanStep(4, 'active');
      }, 6000);
    }

    updateFaceScanStep(stepNumber, status) {
      const step = document.querySelector(`#flashai-vto-step-face-processing .flashai-vto-processing-step[data-step="${stepNumber}"]`);
      if (!step) return;

      const icon = step.querySelector('.flashai-vto-step-icon');
      if (!icon) return;

      if (status === 'active') {
        step.classList.add('active');
        step.classList.remove('complete');
        icon.textContent = '⋯';
      } else if (status === 'complete') {
        step.classList.remove('active');
        step.classList.add('complete');
        icon.textContent = '✓';
      }
    }

    async pollFaceScanStatus(scanId) {
      console.log('[Face Scan] Starting poll for scanId:', scanId);

      this.faceScanPollInterval = setInterval(async () => {
        try {
          // Face scan uses /api/face-scan instead of /api/vto
          const faceScanBaseUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/face-scan');
          const pollUrl = `${faceScanBaseUrl}/${scanId}`;

          console.log('[Face Scan] Polling:', pollUrl);

          const response = await fetch(pollUrl, {
            headers: {
              'X-API-Key': this.config.apiKey
            }
          });

          console.log('[Face Scan] Poll response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[Face Scan] Poll error:', response.status, errorText);
            throw new Error(`Request failed with status code ${response.status}`);
          }

          const data = await response.json();
          console.log('[Face Scan] Poll data:', data);

          if (!data.success) {
            throw new Error(data.error || 'Failed to get scan status');
          }

          const scan = data.data;

          if (scan.status === 'completed') {
            clearInterval(this.faceScanPollInterval);
            this.state.faceScan = scan;

            // Complete all steps
            this.updateFaceScanStep(4, 'complete');

            // Wait a moment for user to see completion
            setTimeout(() => {
              this.displayFaceResults(scan);
            }, 1000);
          } else if (scan.status === 'failed') {
            clearInterval(this.faceScanPollInterval);
            this.showError(scan.error_message || 'Face scan failed. Please try again.');
          }
        } catch (error) {
          console.error('Face scan poll error:', error);
          clearInterval(this.faceScanPollInterval);
          this.showError(error.message);
        }
      }, 2000);
    }

    displayFaceResults(scan) {
      // Store analysis
      this.state.currentAnalysis = scan.analysis;
      this.state.selectedIssue = null;
      this.state.detectedIssues = [];
      this.state.currentFaceView = 'front'; // Default to front view

      // Update skin score
      const scoreElement = document.getElementById('flashai-vto-skin-score');
      if (scoreElement) {
        scoreElement.textContent = scan.analysis?.skin_score || '--';
      }

      // Update progress circle (r=36 for new smaller circle)
      const scoreCircle = document.getElementById('flashai-vto-score-circle');
      if (scoreCircle && scan.analysis?.skin_score) {
        const score = scan.analysis.skin_score;
        const circumference = 2 * Math.PI * 36;
        const offset = circumference - (score / 100) * circumference;
        scoreCircle.style.strokeDashoffset = offset;
      }

      // Update skin tone with undertone and color swatch
      if (scan.analysis) {
        const toneElem = document.getElementById('flashai-vto-skin-tone');
        const swatchElem = document.getElementById('flashai-vto-skin-color-swatch');

        if (toneElem) {
          const tone = this.capitalizeFirst(scan.analysis.skin_tone) || 'N/A';
          const undertone = scan.analysis.skin_undertone;
          // Display as "Olive (Warm)" or just "Olive" if no undertone
          if (undertone && undertone !== 'unknown' && undertone !== 'neutral') {
            toneElem.textContent = `${tone} (${this.capitalizeFirst(undertone)})`;
          } else {
            toneElem.textContent = tone;
          }
        }

        // Update color swatch with actual detected skin hex color
        if (swatchElem && scan.analysis.skin_hex_color) {
          swatchElem.style.background = scan.analysis.skin_hex_color;
        }
      }

      // Show multi-view indicator if multiple views were analyzed
      const viewsAnalyzed = scan.analysis?.views_analyzed || ['front'];
      console.log('[Face Results] Views analyzed:', viewsAnalyzed);

      // Add view switcher if we have multiple views
      this.renderViewSwitcher(viewsAnalyzed);

      // Set up face image
      this.initFaceImage();

      // Generate detected issues with numbered pins
      this.generateDetectedIssues(scan.analysis);

      // Render treatment prioritization, timeline, and healthcare notice
      this.renderTreatmentPriority(scan.analysis);
      this.renderSkincareTimeline(scan.analysis);
      this.checkHealthcareRecommendation(scan.analysis);

      // Show results step
      this.showStep('face-results');
    }

    renderViewSwitcher(viewsAnalyzed) {
      // Add view switcher below the face image container
      const faceContainer = document.getElementById('flashai-vto-face-container');
      if (!faceContainer) return;

      // Remove existing switcher if present
      const existingSwitcher = document.getElementById('flashai-vto-view-switcher');
      if (existingSwitcher) existingSwitcher.remove();

      // Only show switcher if we have multiple views with images
      if (!this.state.faceImagesByView || Object.keys(this.state.faceImagesByView).length <= 1) {
        return;
      }

      const switcher = document.createElement('div');
      switcher.id = 'flashai-vto-view-switcher';
      switcher.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:12px;';

      const views = [
        { key: 'front', label: 'Front', icon: '👤' },
        { key: 'left', label: 'Left', icon: '👈' },
        { key: 'right', label: 'Right', icon: '👉' }
      ];

      views.forEach(view => {
        if (!this.state.faceImagesByView[view.key]) return;

        const btn = document.createElement('button');
        btn.className = `flashai-vto-view-btn ${this.state.currentFaceView === view.key ? 'active' : ''}`;
        btn.innerHTML = `${view.icon} ${view.label}`;
        btn.style.cssText = `
          padding: 6px 12px;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          background: ${this.state.currentFaceView === view.key ? '#18181b' : '#fff'};
          color: ${this.state.currentFaceView === view.key ? '#fff' : '#3f3f46'};
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        `;
        btn.onclick = () => this.switchFaceView(view.key);
        switcher.appendChild(btn);
      });

      // Add switcher after the face container
      faceContainer.parentElement.insertBefore(switcher, faceContainer.nextSibling);

      // Also add a note about multi-view analysis
      const note = document.createElement('div');
      note.style.cssText = 'text-align:center;font-size:11px;color:#71717a;margin-top:6px;';
      note.innerHTML = `<span style="color:#22c55e;">✓</span> Multi-view analysis: ${viewsAnalyzed.length} angles scanned`;
      switcher.appendChild(note);
    }

    switchFaceView(viewKey) {
      if (!this.state.faceImagesByView || !this.state.faceImagesByView[viewKey]) {
        console.warn(`[Face View] No image for view: ${viewKey}`);
        return;
      }

      this.state.currentFaceView = viewKey;
      this.state.faceImageData = this.state.faceImagesByView[viewKey];

      // Update the displayed image
      const faceImg = document.getElementById('flashai-vto-face-image');
      if (faceImg) {
        // Wait for image to load before redrawing overlays
        faceImg.onload = () => {
          this.setupHighlightCanvas();
          this.drawFaceMeshHeatmap();
          this.renderPins();
        };
        faceImg.src = this.state.faceImageData;
      }

      // Update switcher button styles
      const switcher = document.getElementById('flashai-vto-view-switcher');
      if (switcher) {
        switcher.querySelectorAll('.flashai-vto-view-btn').forEach(btn => {
          const isActive = btn.innerHTML.toLowerCase().includes(viewKey);
          btn.style.background = isActive ? '#18181b' : '#fff';
          btn.style.color = isActive ? '#fff' : '#3f3f46';
        });
      }

      console.log(`[Face View] Switched to ${viewKey} view`);
    }

    initFaceImage() {
      const faceImg = document.getElementById('flashai-vto-face-image');
      console.log('[Face Image] Setting up face image, element:', faceImg ? 'found' : 'NOT FOUND');
      console.log('[Face Image] faceImageData:', this.state.faceImageData ? `${this.state.faceImageData.slice(0, 50)}...` : 'NOT SET');

      if (!faceImg) {
        console.error('[Face Image] Image element not found!');
        return;
      }

      if (!this.state.faceImageData) {
        console.error('[Face Image] No face image data stored!');
        // Try to show a placeholder message
        const container = faceImg.parentElement;
        if (container) {
          container.innerHTML = '<div style="padding:40px;text-align:center;background:#f5f5f5;border-radius:16px;"><p style="color:#666;">Face image not available</p></div>';
        }
        return;
      }

      faceImg.onerror = (e) => {
        console.error('[Face Image] Error loading face image:', e);
      };

      faceImg.onload = () => {
        console.log('[Face Image] Image loaded successfully');
        // Set up the highlight canvas to match image dimensions
        this.setupHighlightCanvas();
        // Draw the geometric mesh with heat map overlay
        this.drawFaceMeshHeatmap();
        this.renderPins();
      };

      faceImg.src = this.state.faceImageData;
    }

    setupHighlightCanvas() {
      const faceImg = document.getElementById('flashai-vto-face-image');
      const canvas = document.getElementById('flashai-vto-highlight-canvas');
      if (!faceImg || !canvas) return;

      // Match canvas dimensions to image
      canvas.width = faceImg.naturalWidth || faceImg.offsetWidth;
      canvas.height = faceImg.naturalHeight || faceImg.offsetHeight;
      console.log('[Highlight Canvas] Set up:', canvas.width, 'x', canvas.height);
    }

    drawFaceMeshHeatmap() {
      const canvas = document.getElementById('flashai-vto-highlight-canvas');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const analysis = this.state.currentAnalysis || {};

      ctx.clearRect(0, 0, w, h);

      // Get face outline from ML or use default face region
      const faceOutline = analysis.face_outline || [];

      // Define face center and dimensions for mesh generation
      const faceCenterX = w * 0.5;
      const faceCenterY = h * 0.45;
      const faceWidth = w * 0.55;
      const faceHeight = h * 0.7;

      // Generate mesh grid points if no landmarks available
      const meshPoints = this.generateFaceMeshPoints(faceOutline, w, h, faceCenterX, faceCenterY, faceWidth, faceHeight);

      // Draw the base purple/blue mesh overlay
      this.drawMeshOverlay(ctx, meshPoints, w, h);

      // Draw heat map gradients for problem areas
      this.drawProblemHeatmaps(ctx, analysis, w, h, faceCenterX, faceCenterY, faceWidth, faceHeight);

      // Draw the mesh lines on top
      this.drawMeshLines(ctx, meshPoints, w, h);

      console.log('[Mesh Heatmap] Rendered with', meshPoints.length, 'mesh points');
    }

    generateFaceMeshPoints(faceOutline, w, h, cx, cy, fw, fh) {
      const points = [];

      // If we have real face outline from ML, use it
      if (faceOutline && faceOutline.length > 10) {
        faceOutline.forEach(pt => {
          points.push({ x: pt[0] * w, y: pt[1] * h });
        });
        return points;
      }

      // Generate a grid of points in an oval face shape
      const rows = 12;
      const cols = 8;

      for (let row = 0; row <= rows; row++) {
        const rowRatio = row / rows;
        const y = cy - fh/2 + rowRatio * fh;

        // Calculate width at this row (oval shape - wider in middle)
        const ovalFactor = Math.sin(rowRatio * Math.PI);
        const rowWidth = fw * (0.3 + 0.7 * ovalFactor);

        for (let col = 0; col <= cols; col++) {
          const colRatio = col / cols;
          const x = cx - rowWidth/2 + colRatio * rowWidth;

          // Add some organic variation
          const jitterX = (Math.random() - 0.5) * 8;
          const jitterY = (Math.random() - 0.5) * 8;

          points.push({
            x: x + jitterX,
            y: y + jitterY,
            row, col
          });
        }
      }

      return points;
    }

    drawMeshOverlay(ctx, points, w, h) {
      if (points.length < 3) return;

      // Create a semi-transparent purple/blue base overlay using radial gradient
      const cx = w * 0.5;
      const cy = h * 0.45;
      const radius = Math.min(w, h) * 0.45;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');   // Purple center
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');  // Indigo
      gradient.addColorStop(0.8, 'rgba(79, 70, 229, 0.15)');  // Darker indigo
      gradient.addColorStop(1, 'rgba(67, 56, 202, 0.05)');    // Edge fade

      // Draw oval mask for the face region
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.3, h * 0.4, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    drawProblemHeatmaps(ctx, analysis, w, h, cx, cy, fw, fh) {
      // Define problem regions with their heat intensities
      const problemAreas = [];

      // T-zone oiliness (forehead + nose)
      const oiliness = analysis.oiliness_score || 0;
      if (oiliness > 30) {
        const intensity = Math.min(1, oiliness / 100);
        // Forehead hotspot
        problemAreas.push({
          x: cx, y: cy - fh * 0.25,
          radius: fw * 0.25,
          intensity: intensity * 0.8,
          color: 'orange'
        });
        // Nose hotspot
        problemAreas.push({
          x: cx, y: cy + fh * 0.05,
          radius: fw * 0.12,
          intensity: intensity,
          color: 'orange'
        });
      }

      // Cheek redness
      const redness = analysis.redness_score || 0;
      if (redness > 25) {
        const intensity = Math.min(1, redness / 100);
        // Left cheek
        problemAreas.push({
          x: cx - fw * 0.25, y: cy + fh * 0.05,
          radius: fw * 0.18,
          intensity: intensity * 0.7,
          color: 'red'
        });
        // Right cheek
        problemAreas.push({
          x: cx + fw * 0.25, y: cy + fh * 0.05,
          radius: fw * 0.18,
          intensity: intensity * 0.7,
          color: 'red'
        });
      }

      // Acne spots
      const acneScore = analysis.acne_score || 0;
      if (analysis.acne_locations && analysis.acne_locations.length > 0) {
        analysis.acne_locations.forEach(loc => {
          if (loc.view === 'front' || !loc.view) {
            problemAreas.push({
              x: loc.x * w, y: loc.y * h,
              radius: 15 + (loc.size === 'large' ? 10 : 0),
              intensity: 0.9,
              color: 'yellow'
            });
          }
        });
      } else if (acneScore > 20) {
        // Fallback: show general acne zone
        problemAreas.push({
          x: cx + fw * 0.15, y: cy + fh * 0.12,
          radius: fw * 0.12,
          intensity: Math.min(1, acneScore / 80),
          color: 'yellow'
        });
      }

      // Dark spots / pigmentation
      if (analysis.dark_spots_locations && analysis.dark_spots_locations.length > 0) {
        analysis.dark_spots_locations.forEach(loc => {
          if (loc.view === 'front' || !loc.view) {
            problemAreas.push({
              x: loc.x * w, y: loc.y * h,
              radius: 12 + (loc.size || 0.02) * 300,
              intensity: 0.6,
              color: 'brown'
            });
          }
        });
      }

      // Under-eye dark circles
      const darkCircles = analysis.dark_circles_score || 0;
      if (darkCircles > 20) {
        const intensity = Math.min(1, darkCircles / 100);
        // Left under-eye
        problemAreas.push({
          x: cx - fw * 0.12, y: cy - fh * 0.08,
          radius: fw * 0.1,
          intensity: intensity * 0.5,
          color: 'purple'
        });
        // Right under-eye
        problemAreas.push({
          x: cx + fw * 0.12, y: cy - fh * 0.08,
          radius: fw * 0.1,
          intensity: intensity * 0.5,
          color: 'purple'
        });
      }

      // Draw each problem area as a gradient hotspot
      problemAreas.forEach(area => {
        this.drawHotspot(ctx, area.x, area.y, area.radius, area.intensity, area.color);
      });
    }

    drawHotspot(ctx, x, y, radius, intensity, colorType) {
      // Color schemes for different problem types
      const colorSchemes = {
        orange: {
          inner: `rgba(251, 191, 36, ${intensity * 0.7})`,    // Amber/yellow
          mid: `rgba(245, 158, 11, ${intensity * 0.5})`,      // Orange
          outer: `rgba(234, 88, 12, ${intensity * 0.2})`      // Dark orange
        },
        yellow: {
          inner: `rgba(254, 240, 138, ${intensity * 0.8})`,   // Light yellow
          mid: `rgba(250, 204, 21, ${intensity * 0.5})`,      // Yellow
          outer: `rgba(234, 179, 8, ${intensity * 0.2})`      // Dark yellow
        },
        red: {
          inner: `rgba(252, 165, 165, ${intensity * 0.6})`,   // Light red
          mid: `rgba(248, 113, 113, ${intensity * 0.4})`,     // Red
          outer: `rgba(239, 68, 68, ${intensity * 0.15})`     // Dark red
        },
        purple: {
          inner: `rgba(196, 181, 253, ${intensity * 0.5})`,   // Light purple
          mid: `rgba(167, 139, 250, ${intensity * 0.35})`,    // Purple
          outer: `rgba(139, 92, 246, ${intensity * 0.15})`    // Dark purple
        },
        brown: {
          inner: `rgba(180, 130, 100, ${intensity * 0.5})`,   // Light brown
          mid: `rgba(150, 100, 70, ${intensity * 0.35})`,     // Brown
          outer: `rgba(120, 80, 50, ${intensity * 0.15})`     // Dark brown
        }
      };

      const colors = colorSchemes[colorType] || colorSchemes.orange;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colors.inner);
      gradient.addColorStop(0.5, colors.mid);
      gradient.addColorStop(1, colors.outer);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    drawMeshLines(ctx, points, w, h) {
      if (points.length < 3) return;

      ctx.strokeStyle = 'rgba(200, 200, 220, 0.25)';
      ctx.lineWidth = 0.5;

      // Draw triangulated mesh by connecting nearby points
      const maxDist = Math.min(w, h) * 0.12;

      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[j].x - points[i].x;
          const dy = points[j].y - points[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[j].x, points[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw small dots at mesh vertices
      ctx.fillStyle = 'rgba(200, 200, 220, 0.4)';
      points.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    drawHighlightRegion(highlightRegion, severity = 'moderate') {
      const canvas = document.getElementById('flashai-vto-highlight-canvas');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Clear previous highlight
      ctx.clearRect(0, 0, w, h);

      if (!highlightRegion) return;

      // Severity-based colors: Red (significant), Orange (moderate), Green (mild)
      const severityColors = {
        concern: { fill: 'rgba(220, 38, 38, 0.25)', stroke: 'rgba(220, 38, 38, 0.7)', outer: 'rgba(220, 38, 38, 0.3)' },
        moderate: { fill: 'rgba(245, 158, 11, 0.25)', stroke: 'rgba(245, 158, 11, 0.7)', outer: 'rgba(245, 158, 11, 0.3)' },
        good: { fill: 'rgba(16, 185, 129, 0.25)', stroke: 'rgba(16, 185, 129, 0.7)', outer: 'rgba(16, 185, 129, 0.3)' }
      };

      const colors = severityColors[severity] || severityColors.moderate;

      // Calculate region coordinates from percentage
      const x = (highlightRegion.x / 100) * w;
      const y = (highlightRegion.y / 100) * h;
      const rw = (highlightRegion.w / 100) * w;
      const rh = (highlightRegion.h / 100) * h;

      // Draw semi-transparent highlight with rounded corners
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 3;

      // Draw rounded rectangle
      const radius = 15;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + rw - radius, y);
      ctx.quadraticCurveTo(x + rw, y, x + rw, y + radius);
      ctx.lineTo(x + rw, y + rh - radius);
      ctx.quadraticCurveTo(x + rw, y + rh, x + rw - radius, y + rh);
      ctx.lineTo(x + radius, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Add outer glow effect
      ctx.strokeStyle = colors.outer;
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    clearHighlightRegion() {
      const canvas = document.getElementById('flashai-vto-highlight-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    generateDetectedIssues(analysis) {
      if (!analysis) return;

      const issues = [];
      const attrs = this.getAttributeDefinitions();

      // Define ALL attributes with correct anatomical positions on face
      // Positions are % from top-left of face image
      // highlightRegion defines the area to highlight in red when selected
      const issueConfigs = [
        {
          key: 'dark_circles',
          threshold: 15, // Low threshold to always show
          position: { x: 35, y: 38 }, // Left under-eye area
          region: 'Under Eyes',
          highlightRegion: { x: 25, y: 32, w: 50, h: 15 } // Both under-eye areas
        },
        {
          key: 'wrinkles',
          threshold: 10,
          position: { x: 50, y: 18 }, // Forehead center
          region: 'Forehead & Eyes',
          highlightRegion: { x: 20, y: 10, w: 60, h: 20 } // Forehead area
        },
        {
          key: 'pores',
          threshold: 15,
          position: { x: 50, y: 45 }, // Nose area
          region: 'T-Zone (Nose)',
          highlightRegion: { x: 40, y: 35, w: 20, h: 25 } // T-zone
        },
        {
          key: 'acne',
          threshold: 10,
          position: { x: 65, y: 55 }, // Right cheek
          region: 'Cheeks & Chin',
          highlightRegion: { x: 20, y: 45, w: 60, h: 30 } // Lower face
        },
        {
          key: 'redness',
          threshold: 20,
          position: { x: 30, y: 52 }, // Left cheek
          region: 'Cheeks',
          highlightRegion: { x: 15, y: 40, w: 70, h: 25 } // Cheek areas
        },
        {
          key: 'oiliness',
          threshold: 25,
          position: { x: 50, y: 28 }, // Upper T-zone/forehead
          region: 'T-Zone',
          highlightRegion: { x: 35, y: 15, w: 30, h: 40 } // T-zone vertical
        },
        {
          key: 'pigmentation',
          threshold: 15,
          position: { x: 70, y: 48 }, // Right cheek area
          region: 'Cheeks & Forehead',
          highlightRegion: { x: 20, y: 30, w: 60, h: 35 } // Mid-face
        },
        {
          key: 'hydration',
          threshold: 60, // Show if hydration is below 60%
          isInverse: true,
          position: { x: 50, y: 65 }, // Lower face/chin
          region: 'Full Face',
          highlightRegion: { x: 15, y: 15, w: 70, h: 70 } // Full face
        },
        {
          key: 'texture',
          threshold: 20,
          position: { x: 38, y: 42 }, // Left mid-face
          region: 'Overall Skin',
          highlightRegion: { x: 20, y: 25, w: 60, h: 50 } // Face surface
        }
      ];

      issueConfigs.forEach(config => {
        const attr = attrs[config.key];
        if (!attr) return;

        const score = attr.getScore(analysis);
        const meetsThreshold = config.isInverse ? score < config.threshold : score >= config.threshold;

        if (meetsThreshold) {
          // Determine severity
          let severity, severityLabel;
          if (attr.isGood) {
            severity = score > 70 ? 'good' : score > 40 ? 'moderate' : 'concern';
            severityLabel = score > 70 ? 'Good' : score > 40 ? 'Moderate' : 'Needs Care';
          } else {
            severity = score < 30 ? 'good' : score < 60 ? 'moderate' : 'concern';
            severityLabel = score < 30 ? 'Mild' : score < 60 ? 'Moderate' : 'Significant';
          }

          issues.push({
            key: config.key,
            name: attr.name,
            icon: attr.icon,
            score: Math.round(score),
            severity,
            severityLabel,
            region: config.region,
            position: config.position,
            highlightRegion: config.highlightRegion, // For red overlay when selected
            problem: attr.getProblem(analysis, score),
            solution: attr.getSolution(analysis, score),
            ingredients: attr.getIngredients ? attr.getIngredients() : '',
            usage: attr.getUsage ? attr.getUsage() : '',
            products: attr.getProducts ? attr.getProducts() : []
          });
        }
      });

      // Sort by severity (concern first)
      const severityOrder = { concern: 0, moderate: 1, good: 2 };
      issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      this.state.detectedIssues = issues;
      this.renderIssuesList();
    }

    renderPins() {
      const container = document.getElementById('flashai-vto-pins-container');
      if (!container) return;

      const issues = this.state.detectedIssues;
      const currentView = this.state.currentFaceView || 'front';
      const analysis = this.state.currentAnalysis || {};

      // Severity colors for pins
      const severityColors = {
        concern: { bg: '#ef4444', pulse: 'rgba(239, 68, 68, 0.4)' },
        moderate: { bg: '#f59e0b', pulse: 'rgba(245, 158, 11, 0.4)' },
        good: { bg: '#10b981', pulse: 'rgba(16, 185, 129, 0.4)' }
      };

      // First render issue pins (numbered circles)
      let pinsHtml = issues.map((issue, index) => {
        const colors = severityColors[issue.severity] || severityColors.moderate;
        return `
        <div class="flashai-vto-pin ${issue.severity}"
             data-index="${index}"
             style="position:absolute;left:${issue.position.x}%;top:${issue.position.y}%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:${colors.bg};display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:10;pointer-events:auto;transition:transform 0.2s,box-shadow 0.2s;">
          <span class="flashai-vto-pin-num" style="font-size:12px;font-weight:700;color:#fff;">${index + 1}</span>
          <span class="flashai-vto-pin-pulse" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100%;height:100%;border-radius:50%;background:${colors.pulse};animation:flashai-pin-pulse 2s infinite;pointer-events:none;z-index:-1;"></span>
        </div>
      `;
      }).join('');

      // Also render real detection markers from ML service (smaller dots for actual locations)
      // These show actual detected spots for current view
      const realMarkers = this.getRealMarkersForView(analysis, currentView);
      pinsHtml += realMarkers.map(marker => {
        const colors = severityColors[marker.severity] || severityColors.moderate;
        return `
        <div class="flashai-vto-real-marker ${marker.type}"
             style="position:absolute;left:${marker.x * 100}%;top:${marker.y * 100}%;transform:translate(-50%,-50%);width:${marker.size || 8}px;height:${marker.size || 8}px;border-radius:50%;background:${colors.bg};opacity:0.7;box-shadow:0 0 4px ${colors.pulse};pointer-events:none;z-index:5;"
             title="${marker.label}">
        </div>
      `;
      }).join('');

      container.innerHTML = pinsHtml;

      // Add click handlers for issue pins
      container.querySelectorAll('.flashai-vto-pin').forEach(pin => {
        pin.addEventListener('click', () => {
          const index = parseInt(pin.dataset.index);
          this.selectIssue(index);
        });
      });

      console.log(`[Pins] Rendered ${issues.length} issue pins + ${realMarkers.length} real markers for ${currentView} view`);
    }

    getRealMarkersForView(analysis, currentView) {
      const markers = [];

      // Acne locations
      if (analysis.acne_locations) {
        analysis.acne_locations.forEach(loc => {
          // Only show markers for current view (or all if view not specified)
          if (!loc.view || loc.view === currentView) {
            markers.push({
              x: loc.x,
              y: loc.y,
              type: 'acne',
              severity: 'concern',
              size: loc.type === 'pimple' ? 10 : 6,
              label: `${loc.type || 'blemish'} (${loc.view || 'front'})`
            });
          }
        });
      }

      // Dark spots
      if (analysis.dark_spots_locations) {
        analysis.dark_spots_locations.forEach(loc => {
          if (!loc.view || loc.view === currentView) {
            markers.push({
              x: loc.x,
              y: loc.y,
              type: 'pigmentation',
              severity: 'moderate',
              size: Math.max(6, Math.min(12, (loc.size || 0.02) * 400)),
              label: `dark spot (${loc.view || 'front'})`
            });
          }
        });
      }

      // Enlarged pores
      if (analysis.enlarged_pores_locations) {
        analysis.enlarged_pores_locations.forEach(loc => {
          if (!loc.view || loc.view === currentView) {
            markers.push({
              x: loc.x,
              y: loc.y,
              type: 'pores',
              severity: 'moderate',
              size: 5,
              label: `enlarged pore (${loc.view || 'front'})`
            });
          }
        });
      }

      return markers;
    }

    renderIssuesList() {
      const listContainer = document.getElementById('flashai-vto-issues-list');
      if (!listContainer) return;

      const issues = this.state.detectedIssues;

      if (issues.length === 0) {
        listContainer.innerHTML = `
          <div class="flashai-vto-no-issues" style="text-align:center;padding:24px;background:#f0fdf4;border-radius:12px;">
            <span style="font-size:32px;">✨</span>
            <p style="font-size:14px;color:#15803d;margin:8px 0 0;">Great news! No significant skin concerns detected.</p>
          </div>
        `;
        return;
      }

      // Severity colors - Red (Significant), Orange (Moderate), Green (Mild)
      const severityColors = {
        concern: { bg: '#fef2f2', border: '#fecaca', num: '#dc2626', badge: '#dc2626', badgeBg: '#fee2e2', highlight: 'rgba(220, 38, 38, 0.3)' },
        moderate: { bg: '#fffbeb', border: '#fde68a', num: '#d97706', badge: '#d97706', badgeBg: '#fef3c7', highlight: 'rgba(245, 158, 11, 0.3)' },
        good: { bg: '#f0fdf4', border: '#bbf7d0', num: '#16a34a', badge: '#16a34a', badgeBg: '#dcfce7', highlight: 'rgba(16, 185, 129, 0.3)' }
      };

      // Accordion-style list items with inline expansion
      listContainer.innerHTML = issues.map((issue, index) => {
        const colors = severityColors[issue.severity] || severityColors.moderate;
        return `
        <div class="flashai-vto-accordion-item" data-index="${index}" style="margin-bottom:8px;">
          <!-- Header (clickable) -->
          <div class="flashai-vto-accordion-header ${issue.severity}" data-index="${index}"
               style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${colors.bg};border:2px solid ${colors.border};border-radius:12px;cursor:pointer;transition:all 0.2s;">
            <span class="flashai-vto-issue-num" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${colors.num};color:#fff;font-size:13px;font-weight:700;flex-shrink:0;">${index + 1}</span>
            <div class="flashai-vto-issue-info" style="flex:1;min-width:0;">
              <span class="flashai-vto-issue-name" style="display:block;font-size:14px;font-weight:600;color:#18181b;">${issue.name}</span>
              <span class="flashai-vto-issue-region" style="display:block;font-size:12px;color:#71717a;margin-top:2px;">${issue.region}</span>
            </div>
            <div class="flashai-vto-issue-badge" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${colors.badgeBg};color:${colors.badge};text-transform:uppercase;letter-spacing:0.5px;">${issue.severityLabel}</div>
            <svg class="flashai-vto-accordion-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${colors.num}" stroke-width="2.5" style="flex-shrink:0;transition:transform 0.3s;">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
          <!-- Expanded Content (hidden by default) -->
          <div class="flashai-vto-accordion-content" data-index="${index}" style="display:none;padding:16px;background:#fff;border:2px solid ${colors.border};border-top:none;border-radius:0 0 12px 12px;margin-top:-8px;">
            <!-- Zoomed Face Region -->
            <div class="flashai-vto-zoomed-region" style="margin-bottom:16px;border-radius:12px;overflow:hidden;position:relative;">
              <canvas class="flashai-vto-zoom-canvas" data-index="${index}" style="width:100%;height:auto;display:block;border-radius:12px;"></canvas>
              <div style="position:absolute;top:8px;left:8px;background:${colors.num};color:#fff;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700;">${issue.region}</div>
            </div>
            <!-- Problem -->
            <div style="margin-bottom:12px;padding:12px;background:#f9fafb;border-radius:8px;border-left:3px solid ${colors.num};">
              <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🔍 Problem</div>
              <p style="font-size:13px;line-height:1.5;color:#374151;margin:0;">${issue.problem}</p>
            </div>
            <!-- Solution -->
            <div style="margin-bottom:12px;padding:12px;background:linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, #f9fafb 100%);border-radius:8px;border-left:3px solid #10b981;">
              <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">💡 Solution</div>
              <p style="font-size:13px;line-height:1.5;color:#374151;margin:0;">${issue.solution}</p>
            </div>
            <!-- Ingredients to Check -->
            <div style="margin-bottom:12px;padding:12px;background:linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, #faf5ff 100%);border-radius:8px;border-left:3px solid #8b5cf6;">
              <div style="font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🧪 Ingredients to Look For</div>
              <p style="font-size:13px;line-height:1.5;color:#374151;margin:0;">${issue.ingredients}</p>
            </div>
            <!-- How to Use/Apply -->
            <div style="margin-bottom:12px;padding:12px;background:linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, #eff6ff 100%);border-radius:8px;border-left:3px solid #3b82f6;">
              <div style="font-size:10px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">📝 How to Use/Apply</div>
              <p style="font-size:13px;line-height:1.5;color:#374151;margin:0;">${issue.usage}</p>
            </div>
            <!-- Recommended Products -->
            ${issue.products && issue.products.length > 0 ? `
            <div style="padding:12px;background:linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, #faf5ff 100%);border-radius:8px;border-left:3px solid #8b5cf6;">
              <div style="font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🛒 Recommended Products</div>
              ${issue.products.map(p => `
                <div style="margin-bottom:10px;padding:8px;background:rgba(255,255,255,0.7);border-radius:6px;">
                  <div style="font-size:12px;font-weight:600;color:#7c3aed;margin-bottom:4px;">${p.name}</div>
                  <div style="font-size:11px;color:#6b7280;line-height:1.4;"><strong style="color:#374151;">Top Brands:</strong> ${p.brands}</div>
                </div>
              `).join('')}
            </div>
            ` : ''}
          </div>
        </div>
      `;
      }).join('');

      // Add click handlers for accordion headers
      listContainer.querySelectorAll('.flashai-vto-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
          const index = parseInt(header.dataset.index);
          this.toggleAccordion(index);
        });
      });
    }

    toggleAccordion(index) {
      const issues = this.state.detectedIssues;
      if (index < 0 || index >= issues.length) return;

      const issue = issues[index];
      const wasExpanded = this.state.expandedIssue === index;

      // Close all accordions first
      document.querySelectorAll('.flashai-vto-accordion-content').forEach(content => {
        content.style.display = 'none';
      });
      document.querySelectorAll('.flashai-vto-accordion-arrow').forEach(arrow => {
        arrow.style.transform = 'rotate(0deg)';
      });
      document.querySelectorAll('.flashai-vto-accordion-header').forEach(header => {
        header.style.borderRadius = '12px';
      });

      // Reset all pins
      document.querySelectorAll('.flashai-vto-pin').forEach(pin => {
        pin.style.transform = 'translate(-50%, -50%) scale(1)';
        pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        pin.style.zIndex = '10';
      });

      // Clear highlight
      this.clearHighlightRegion();

      if (wasExpanded) {
        // Just collapse
        this.state.expandedIssue = null;
        return;
      }

      // Expand this accordion
      this.state.expandedIssue = index;

      const header = document.querySelector(`.flashai-vto-accordion-header[data-index="${index}"]`);
      const content = document.querySelector(`.flashai-vto-accordion-content[data-index="${index}"]`);
      const arrow = header?.querySelector('.flashai-vto-accordion-arrow');
      const pin = document.querySelector(`.flashai-vto-pin[data-index="${index}"]`);

      if (header) header.style.borderRadius = '12px 12px 0 0';
      if (arrow) arrow.style.transform = 'rotate(180deg)';
      if (content) {
        content.style.display = 'block';
        // Draw zoomed region
        this.drawZoomedRegion(index, issue);
      }

      // Highlight pin
      if (pin) {
        pin.style.transform = 'translate(-50%, -50%) scale(1.4)';
        pin.style.boxShadow = '0 0 0 4px #fff, 0 4px 16px rgba(0,0,0,0.5)';
        pin.style.zIndex = '20';
      }

      // Draw highlight on main image with severity color
      this.drawHighlightRegion(issue.highlightRegion, issue.severity);

      // Scroll to show expanded content
      content?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    drawZoomedRegion(index, issue) {
      const canvas = document.querySelector(`.flashai-vto-zoom-canvas[data-index="${index}"]`);
      const faceImg = document.getElementById('flashai-vto-face-image');
      if (!canvas || !faceImg || !issue.highlightRegion) return;

      const ctx = canvas.getContext('2d');
      const hr = issue.highlightRegion;

      // Calculate source region (with some padding)
      const padding = 5; // 5% padding
      const srcX = Math.max(0, (hr.x - padding) / 100);
      const srcY = Math.max(0, (hr.y - padding) / 100);
      const srcW = Math.min(1 - srcX, (hr.w + padding * 2) / 100);
      const srcH = Math.min(1 - srcY, (hr.h + padding * 2) / 100);

      const sx = srcX * faceImg.naturalWidth;
      const sy = srcY * faceImg.naturalHeight;
      const sw = srcW * faceImg.naturalWidth;
      const sh = srcH * faceImg.naturalHeight;

      // Set canvas size (maintain aspect ratio, max 200px height)
      const aspectRatio = sw / sh;
      const maxHeight = 150;
      canvas.height = maxHeight;
      canvas.width = maxHeight * aspectRatio;

      // Draw cropped/zoomed region
      ctx.drawImage(faceImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      // Draw REAL markers from ML analysis data
      // Pass the source region bounds so we can transform coordinates
      const analysis = this.state.currentAnalysis || {};

      // Draw heatmap gradient overlay for this issue type
      this.drawZoomedHeatmap(ctx, canvas.width, canvas.height, issue, analysis);

      // Draw issue-specific markers on top
      this.drawRealMarkers(ctx, canvas.width, canvas.height, issue, analysis, {
        srcX, srcY, srcW, srcH
      });

      // Draw severity-colored border overlay
      const severityColors = {
        concern: 'rgba(220, 38, 38, 0.6)',
        moderate: 'rgba(245, 158, 11, 0.5)',
        good: 'rgba(16, 185, 129, 0.4)'
      };

      // Draw colored border
      ctx.strokeStyle = severityColors[issue.severity] || severityColors.moderate;
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }

    drawZoomedHeatmap(ctx, width, height, issue, analysis) {
      // Draw a gradient heatmap overlay based on issue type and severity
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.6;

      // Get score for this issue
      let score = 0;
      let colorScheme = 'orange';

      switch (issue.key) {
        case 'oiliness':
          score = analysis.oiliness_score || 0;
          colorScheme = 'orange';
          break;
        case 'redness':
          score = analysis.redness_score || 0;
          colorScheme = 'red';
          break;
        case 'acne':
          score = analysis.acne_score || 0;
          colorScheme = 'yellow';
          break;
        case 'dark_circles':
          score = analysis.dark_circles_score || 0;
          colorScheme = 'purple';
          break;
        case 'pigmentation':
          score = analysis.pigmentation_score || 0;
          colorScheme = 'brown';
          break;
        case 'wrinkles':
          score = analysis.wrinkle_score || 0;
          colorScheme = 'orange';
          break;
        case 'pores':
          score = (analysis.enlarged_pores_count || 0) * 5;
          colorScheme = 'orange';
          break;
        case 'texture':
          score = 100 - (analysis.texture_score || 70);
          colorScheme = 'orange';
          break;
        case 'hydration':
          score = 100 - (analysis.hydration_score || 65);
          colorScheme = 'blue';
          break;
        default:
          return; // No heatmap for unknown issues
      }

      // Only draw if score is significant
      if (score < 15) return;

      const intensity = Math.min(0.5, score / 150);

      // Color schemes for different issue types
      const schemes = {
        orange: {
          inner: `rgba(251, 191, 36, ${intensity})`,
          outer: `rgba(245, 158, 11, ${intensity * 0.3})`
        },
        yellow: {
          inner: `rgba(254, 240, 138, ${intensity})`,
          outer: `rgba(250, 204, 21, ${intensity * 0.3})`
        },
        red: {
          inner: `rgba(252, 165, 165, ${intensity})`,
          outer: `rgba(248, 113, 113, ${intensity * 0.3})`
        },
        purple: {
          inner: `rgba(196, 181, 253, ${intensity})`,
          outer: `rgba(139, 92, 246, ${intensity * 0.3})`
        },
        brown: {
          inner: `rgba(180, 130, 100, ${intensity})`,
          outer: `rgba(120, 80, 50, ${intensity * 0.3})`
        },
        blue: {
          inner: `rgba(147, 197, 253, ${intensity})`,
          outer: `rgba(59, 130, 246, ${intensity * 0.3})`
        }
      };

      const colors = schemes[colorScheme] || schemes.orange;

      // Draw radial gradient heatmap
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, colors.inner);
      gradient.addColorStop(0.7, colors.outer);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    drawRealMarkers(ctx, width, height, issue, analysis, srcBounds) {
      const { srcX, srcY, srcW, srcH } = srcBounds;
      const severity = issue.severity;

      // Colors based on severity
      const colors = {
        concern: { fill: 'rgba(220, 38, 38, 0.8)', stroke: '#dc2626' },
        moderate: { fill: 'rgba(245, 158, 11, 0.7)', stroke: '#f59e0b' },
        good: { fill: 'rgba(16, 185, 129, 0.6)', stroke: '#10b981' }
      };
      const color = colors[severity] || colors.moderate;

      ctx.save();

      // Transform function: convert ML coordinates (0-1) to zoomed canvas coordinates
      const transformX = (x) => ((x - srcX) / srcW) * width;
      const transformY = (y) => ((y - srcY) / srcH) * height;
      const isInBounds = (x, y) => x >= srcX && x <= srcX + srcW && y >= srcY && y <= srcY + srcH;

      switch(issue.key) {
        case 'acne':
          // Draw REAL acne locations from ML
          const acneLocations = analysis.acne_locations || [];
          acneLocations.forEach(spot => {
            if (isInBounds(spot.x, spot.y)) {
              const x = transformX(spot.x);
              const y = transformY(spot.y);
              const size = spot.size === 'large' ? 6 : spot.size === 'medium' ? 5 : 4;

              // Glow effect
              ctx.shadowColor = color.stroke;
              ctx.shadowBlur = 6;

              ctx.beginPath();
              ctx.arc(x, y, size, 0, Math.PI * 2);
              ctx.fillStyle = spot.type === 'pimple' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 180, 0, 0.9)';
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.shadowBlur = 0;
            }
          });
          break;

        case 'pigmentation':
          // Draw REAL dark spot locations from ML
          const darkSpots = analysis.dark_spots_locations || [];
          darkSpots.forEach(spot => {
            if (isInBounds(spot.x, spot.y)) {
              const x = transformX(spot.x);
              const y = transformY(spot.y);
              const size = Math.max(4, Math.min(10, (spot.size || 0.01) * 500));

              ctx.shadowColor = 'rgba(139, 69, 19, 0.5)';
              ctx.shadowBlur = 4;

              ctx.beginPath();
              ctx.arc(x, y, size, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(139, 69, 19, 0.8)';
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.shadowBlur = 0;
            }
          });
          break;

        case 'wrinkles':
          // Draw wrinkle regions from ML
          const wrinkleRegions = analysis.wrinkle_regions || {};
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);

          Object.entries(wrinkleRegions).forEach(([region, data]) => {
            if (data && data.bbox) {
              const [x1, y1, x2, y2] = data.bbox;
              if (isInBounds((x1+x2)/2, (y1+y2)/2)) {
                const tx1 = transformX(x1), ty1 = transformY(y1);
                const tx2 = transformX(x2), ty2 = transformY(y2);

                // Draw lines across the region
                const numLines = Math.max(1, Math.floor((data.severity || 0.3) * 4));
                for (let i = 0; i < numLines; i++) {
                  const y = ty1 + (ty2 - ty1) * (i + 0.5) / numLines;
                  ctx.beginPath();
                  ctx.moveTo(tx1, y);
                  ctx.lineTo(tx2, y);
                  ctx.stroke();
                }
              }
            }
          });
          ctx.setLineDash([]);
          break;

        case 'dark_circles':
          // Draw under-eye regions from dark_circles_regions (returned by ML service)
          const darkCirclesRegions = analysis.dark_circles_regions || {};
          const leftEye = darkCirclesRegions.left_eye;
          const rightEye = darkCirclesRegions.right_eye;

          ctx.fillStyle = `rgba(75, 0, 130, ${Math.min(0.4, (analysis.dark_circles_score || 30) / 100)})`;
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 2;

          if (leftEye && leftEye.bbox && isInBounds((leftEye.bbox[0]+leftEye.bbox[2])/2, (leftEye.bbox[1]+leftEye.bbox[3])/2)) {
            const [x1, y1, x2, y2] = leftEye.bbox;
            ctx.beginPath();
            ctx.ellipse(transformX((x1+x2)/2), transformY((y1+y2)/2),
              (transformX(x2) - transformX(x1)) / 2, (transformY(y2) - transformY(y1)) / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          if (rightEye && rightEye.bbox && isInBounds((rightEye.bbox[0]+rightEye.bbox[2])/2, (rightEye.bbox[1]+rightEye.bbox[3])/2)) {
            const [x1, y1, x2, y2] = rightEye.bbox;
            ctx.beginPath();
            ctx.ellipse(transformX((x1+x2)/2), transformY((y1+y2)/2),
              (transformX(x2) - transformX(x1)) / 2, (transformY(y2) - transformY(y1)) / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          break;

        case 'redness':
          // Draw redness regions from ML
          const rednessRegions = analysis.redness_regions || [];
          ctx.fillStyle = `rgba(220, 38, 38, ${Math.min(0.35, (analysis.redness_score || 30) / 150)})`;

          rednessRegions.forEach(region => {
            if (region.bbox) {
              const [x1, y1, x2, y2] = region.bbox;
              if (isInBounds((x1+x2)/2, (y1+y2)/2)) {
                ctx.beginPath();
                ctx.ellipse(transformX((x1+x2)/2), transformY((y1+y2)/2),
                  (transformX(x2) - transformX(x1)) / 2, (transformY(y2) - transformY(y1)) / 2, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          });
          break;

        case 'pores':
          // Draw enlarged pore locations from ML
          const poreLocations = analysis.enlarged_pores_locations || [];
          ctx.fillStyle = color.fill;

          poreLocations.forEach(pore => {
            if (isInBounds(pore.x, pore.y)) {
              const x = transformX(pore.x);
              const y = transformY(pore.y);
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          });
          break;

        default:
          // For other issues, draw a subtle severity-based overlay
          const alpha = severity === 'concern' ? 0.15 : severity === 'moderate' ? 0.1 : 0.05;
          ctx.fillStyle = color.fill.replace(/[\d.]+\)$/, `${alpha})`);
          ctx.fillRect(0, 0, width, height);
          break;
      }

      ctx.restore();
    }

    // Old marker functions removed - now using subtle overlays via drawIssueIndicator

    selectIssue(index) {
      // Delegate to toggleAccordion for consistency
      this.toggleAccordion(index);
    }

    closeIssueDetail() {
      // Close any expanded accordion
      this.state.expandedIssue = null;
      document.querySelectorAll('.flashai-vto-accordion-content').forEach(content => {
        content.style.display = 'none';
      });
      document.querySelectorAll('.flashai-vto-accordion-arrow').forEach(arrow => {
        arrow.style.transform = 'rotate(0deg)';
      });
      document.querySelectorAll('.flashai-vto-accordion-header').forEach(header => {
        header.style.borderRadius = '12px';
      });
      this.clearHighlightRegion();
      document.querySelectorAll('.flashai-vto-pin').forEach(pin => {
        pin.style.transform = 'translate(-50%, -50%) scale(1)';
        pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        pin.style.zIndex = '10';
      });
    }

    // Legacy method for backward compatibility
    highlightAttributeOnFace(attribute) {
      // Find issue by key and select it
      const index = this.state.detectedIssues.findIndex(i => i.key === attribute);
      if (index >= 0) this.selectIssue(index);
    }

    // Legacy method - kept for compatibility
    selectAttribute(attribute) {
      this.highlightAttributeOnFace(attribute);
    }

    // Attribute definitions with problems and solutions
    getAttributeDefinitions() {
      return {
        dark_circles: {
          name: 'Dark Circles',
          icon: '👁️',
          getScore: (a) => a.dark_circles_score || 0,
          isGood: false,
          getProblem: (a, score) => {
            if (score < 30) return 'Your under-eye area looks healthy with minimal darkness.';
            if (score < 60) return 'Moderate dark circles detected under your eyes, likely from fatigue or genetics.';
            return 'Significant dark circles visible. This could indicate lack of sleep, dehydration, or genetics.';
          },
          getSolution: (a, score) => {
            if (score < 30) return 'Maintain good sleep habits and stay hydrated to keep this area healthy.';
            return 'Use an eye cream with Vitamin C, caffeine, or retinol. Ensure 7-8 hours of sleep and stay hydrated. Cold compresses can help reduce puffiness.';
          },
          getIngredients: () => 'Vitamin C, Caffeine, Vitamin K, Retinol, Niacinamide, Peptides, Hyaluronic Acid',
          getUsage: () => 'Apply a pea-sized amount of eye cream to your ring finger. Gently pat (don\'t rub) around the orbital bone, from inner to outer corner. Use morning and night after cleansing and before moisturizer.',
          getProducts: () => [
            { name: 'Eye Cream with Caffeine', brands: 'The Ordinary Caffeine Solution 5% (Nykaa), Minimalist 5% Caffeine Eye Serum, Plum Bright Years Under-Eye Recovery Gel' },
            { name: 'Vitamin C Eye Serum', brands: 'Dot & Key Vitamin C + E Super Bright Eye Cream, Mamaearth Vitamin C Under Eye Cream, Kiehl\'s Powerful-Strength Eye (Nykaa)' },
            { name: 'Retinol Eye Cream', brands: 'Minimalist 0.3% Retinol Eye Cream, Olay Regenerist Retinol24 Eye Cream, Neutrogena Rapid Wrinkle Repair Eye' }
          ]
        },
        acne: {
          name: 'Acne & Blemishes',
          icon: '🎯',
          getScore: (a) => a.acne_score || 0,
          isGood: false,
          getProblem: (a, score) => {
            const count = (a.whitehead_count || 0) + (a.blackhead_count || 0) + (a.pimple_count || 0);
            if (score < 20) return 'Your skin is clear with minimal blemishes.';
            if (score < 50) return `${count} active blemishes detected. This is common and manageable with proper care.`;
            return `${count} blemishes found including possible inflammation. Your skin may need targeted treatment.`;
          },
          getSolution: (a, score) => {
            if (score < 20) return 'Continue your current routine. Use non-comedogenic products to prevent future breakouts.';
            return 'Use a gentle cleanser with Salicylic Acid or Benzoyl Peroxide. Avoid touching your face and change pillowcases frequently. Consider a spot treatment for active breakouts.';
          },
          getIngredients: () => 'Salicylic Acid (BHA), Benzoyl Peroxide, Tea Tree Oil, Niacinamide, Zinc, Sulfur, Azelaic Acid',
          getUsage: () => 'Cleanse face twice daily with acne cleanser. Apply spot treatment directly on blemishes at night. Use oil-free moisturizer. For prevention, use BHA toner 2-3 times per week on affected areas.',
          getProducts: () => [
            { name: 'Salicylic Acid Cleanser', brands: 'Minimalist 2% Salicylic Acid Face Wash, CeraVe SA Cleanser (Nykaa), Neutrogena Oil-Free Acne Wash, Himalaya Purifying Neem Face Wash' },
            { name: 'Acne Treatment Gel', brands: 'Minimalist 2% Salicylic Acid Serum, Re\'equil Acne Clarifying Gel, Fixderma Salyzap Daily Use Gel, La Roche-Posay Effaclar Duo (Nykaa)' },
            { name: 'Spot Treatment & Patches', brands: 'COSRX Acne Pimple Master Patch (Nykaa), Dot & Key Acne Spot Corrector, The Ordinary Niacinamide 10% + Zinc 1% (Nykaa)' }
          ]
        },
        wrinkles: {
          name: 'Lines & Wrinkles',
          icon: '✨',
          getScore: (a) => a.wrinkle_score || 0,
          isGood: false,
          getProblem: (a, score) => {
            if (score < 20) return 'Minimal fine lines detected. Your skin shows good elasticity.';
            if (score < 50) return 'Some fine lines visible, particularly around expression areas like forehead and eyes.';
            return 'Notable wrinkles detected in multiple areas including forehead, crow\'s feet, and nasolabial folds.';
          },
          getSolution: (a, score) => {
            if (score < 20) return 'Start using SPF daily and a light retinol serum at night to maintain skin youth.';
            return 'Use Retinol or Retinoid products at night. Apply SPF 30+ daily. Consider products with Peptides and Hyaluronic Acid for plumping effect.';
          },
          getIngredients: () => 'Retinol/Retinoid, Peptides, Hyaluronic Acid, Vitamin C, Bakuchiol (natural alternative), Collagen, CoQ10',
          getUsage: () => 'Start with retinol 2x/week at night, gradually increasing to nightly use. Apply pea-sized amount to clean, dry skin. Wait 20 mins before moisturizer. Always use SPF next morning. Avoid mixing with Vitamin C or AHAs.',
          getProducts: () => [
            { name: 'Retinol Serum', brands: 'Minimalist 0.3% Retinol Serum, The Ordinary Retinol 0.5% (Nykaa), Olay Regenerist Retinol24 Serum, Neutrogena Rapid Wrinkle Repair' },
            { name: 'Peptide Cream', brands: 'The Ordinary Buffet (Nykaa), Olay Regenerist Micro-Sculpting Cream, Minimalist Multi-Peptide Serum, Plum Bright Years Cell Renewal Serum' },
            { name: 'Sunscreen SPF 50+', brands: 'La Roche-Posay Anthelios (Nykaa), Minimalist SPF 50 Sunscreen, Re\'equil Ultra Matte SPF 50, Lakme Sun Expert SPF 50' }
          ]
        },
        pigmentation: {
          name: 'Pigmentation',
          icon: '☀️',
          getScore: (a) => a.pigmentation_score || 0,
          isGood: false,
          getProblem: (a, score) => {
            const spots = a.dark_spots_count || 0;
            if (score < 20) return 'Even skin tone with minimal dark spots detected.';
            if (score < 50) return `${spots} dark spots detected. This may be from sun exposure or post-inflammatory marks.`;
            return `Significant uneven pigmentation with ${spots} dark spots. Signs of sun damage or melasma may be present.`;
          },
          getSolution: (a, score) => {
            if (score < 20) return 'Maintain SPF use daily to prevent future pigmentation.';
            return 'Use Vitamin C serum in the morning and Niacinamide for brightening. Apply SPF 50 daily. Consider products with Alpha Arbutin or Kojic Acid for stubborn spots.';
          },
          getIngredients: () => 'Vitamin C (L-Ascorbic Acid), Niacinamide, Alpha Arbutin, Kojic Acid, Tranexamic Acid, Licorice Root Extract, Azelaic Acid',
          getUsage: () => 'Apply Vitamin C serum every morning after cleansing, before SPF. Use brightening serums with Alpha Arbutin at night. Apply SPF 50 generously and reapply every 2 hours when outdoors. Be patient - results take 8-12 weeks.',
          getProducts: () => [
            { name: 'Vitamin C Serum', brands: 'Minimalist 10% Vitamin C Serum, The Ordinary Vitamin C Suspension 23% (Nykaa), Plum 15% Vitamin C Serum, Garnier Bright Complete Vitamin C Serum' },
            { name: 'Brightening Serum', brands: 'Minimalist Alpha Arbutin 2% Serum, The Ordinary Alpha Arbutin 2% (Nykaa), Dot & Key Vitamin C Glow Serum, Deconstruct 10% Niacinamide Serum' },
            { name: 'Sunscreen SPF 50+', brands: 'La Roche-Posay Anthelios (Nykaa), Minimalist SPF 50 Sunscreen, Bioderma Photoderm SPF 50+, Cipla Rivela SPF 50' }
          ]
        },
        redness: {
          name: 'Redness & Sensitivity',
          icon: '🌸',
          getScore: (a) => a.redness_score || 0,
          isGood: false,
          getProblem: (a, score) => {
            if (score < 20) return 'Minimal redness detected. Your skin appears calm and balanced.';
            if (score < 50) return 'Some redness visible, particularly on cheeks. Your skin may be slightly sensitive.';
            return 'Significant redness detected. This could indicate sensitivity, rosacea, or irritation from products.';
          },
          getSolution: (a, score) => {
            if (score < 20) return 'Continue using gentle products. Avoid harsh exfoliants to maintain calm skin.';
            return 'Use fragrance-free, hypoallergenic products. Look for Centella Asiatica, Aloe Vera, or Green Tea. Avoid hot water and harsh scrubs. Consider Azelaic Acid for rosacea-prone skin.';
          },
          getIngredients: () => 'Centella Asiatica (Cica), Aloe Vera, Green Tea, Azelaic Acid, Allantoin, Chamomile, Oat Extract, Panthenol',
          getUsage: () => 'Use lukewarm water only. Apply calming products with gentle patting motions. Layer Cica serum before moisturizer. Avoid actives (AHA, retinol) until redness subsides. Test new products on small area first.',
          getProducts: () => [
            { name: 'Calming Cleanser', brands: 'Cetaphil Gentle Skin Cleanser, Simple Kind To Skin Refreshing Facial Wash, Bioderma Sensibio Gel Moussant, CeraVe Hydrating Cleanser (Nykaa)' },
            { name: 'Cica/Centella Serum', brands: 'Minimalist Sepicalm 3% + Oats Moisturizer, COSRX Centella Blemish Cream (Nykaa), Innisfree Bija Cica Balm, Dr. Sheth\'s Cica & Ceramide Overnight Repair Serum' },
            { name: 'Soothing Moisturizer', brands: 'La Roche-Posay Cicaplast Baume B5 (Nykaa), Bioderma Atoderm Intensive Baume, Re\'equil Ceramide & Hyaluronic Acid Moisturizer, Avene Skin Recovery Cream (Nykaa)' }
          ]
        },
        hydration: {
          name: 'Hydration',
          icon: '💧',
          getScore: (a) => a.hydration_score || 0,
          isGood: true,
          getProblem: (a, score) => {
            if (score > 70) return 'Excellent hydration levels! Your skin barrier appears healthy and plump.';
            if (score > 40) return 'Moderate hydration. Some areas may feel tight or show fine dehydration lines.';
            return 'Low hydration detected. Your skin may feel tight, look dull, or show premature fine lines.';
          },
          getSolution: (a, score) => {
            if (score > 70) return 'Maintain your hydration routine. Continue drinking water and using moisturizer.';
            return 'Use Hyaluronic Acid serum on damp skin. Apply a rich moisturizer and consider overnight sleeping masks. Drink at least 8 glasses of water daily.';
          },
          getIngredients: () => 'Hyaluronic Acid, Glycerin, Ceramides, Squalane, Aloe Vera, Beta Glucan, Sodium PCA, Urea',
          getUsage: () => 'Apply Hyaluronic Acid serum on DAMP skin (this is crucial!). Layer from thinnest to thickest: toner → serum → moisturizer. Use a sleeping mask 2-3x/week. Drink 8+ glasses of water daily.',
          getProducts: () => [
            { name: 'Hyaluronic Acid Serum', brands: 'Minimalist 2% Hyaluronic Acid Serum, The Ordinary Hyaluronic Acid 2% + B5 (Nykaa), Neutrogena Hydro Boost Serum, Plum Grape Seed & Sea Buckthorn Glow Serum' },
            { name: 'Hydrating Moisturizer', brands: 'CeraVe Moisturizing Cream (Nykaa), Neutrogena Hydro Boost Gel-Cream, Minimalist Sepicalm Moisturizer, Pond\'s Super Light Gel' },
            { name: 'Sleeping Mask', brands: 'Laneige Water Sleeping Mask (Nykaa/Sephora), Innisfree Aloe Revital Sleeping Pack, Dot & Key Glow Reviving Vitamin C Sleeping Mask, Plum Green Tea Renewed Clarity Night Gel' }
          ]
        },
        oiliness: {
          name: 'Oiliness',
          icon: '🧴',
          getScore: (a) => Math.round((a.oiliness_score || a.t_zone_oiliness * 100 || 0)),
          isGood: false,
          getProblem: (a, score) => {
            if (score < 30) return 'Normal oil levels. Your skin has a healthy balance.';
            if (score < 60) return 'Moderate oiliness in the T-zone (forehead, nose, chin). This is common for combination skin.';
            return 'High oil production detected, particularly in the T-zone. This may lead to enlarged pores and breakouts.';
          },
          getSolution: (a, score) => {
            if (score < 30) return 'Your oil levels are balanced. Use a light moisturizer to maintain this balance.';
            return 'Use a gentle foaming cleanser and oil-free moisturizer. Try Niacinamide to regulate sebum. Use clay masks 1-2x weekly. Avoid over-cleansing which can increase oil production.';
          },
          getIngredients: () => 'Niacinamide, Salicylic Acid, Kaolin Clay, Zinc, Tea Tree Oil, Witch Hazel, Green Tea Extract',
          getUsage: () => 'Cleanse with foaming gel cleanser morning and night. Apply Niacinamide serum to T-zone after toning. Use oil-free gel moisturizer. Apply clay mask to oily areas 1-2x weekly for 10-15 mins. Blotting papers for midday touch-ups.',
          getProducts: () => [
            { name: 'Oil-Control Cleanser', brands: 'CeraVe Foaming Facial Cleanser (Nykaa), Neutrogena Deep Clean Facial Cleanser, Himalaya Oil Clear Lemon Face Wash, Plum Green Tea Pore Cleansing Face Wash' },
            { name: 'Niacinamide Serum', brands: 'Minimalist 10% Niacinamide Serum, The Ordinary Niacinamide 10% + Zinc 1% (Nykaa), Deconstruct 10% Niacinamide Serum, Mamaearth Vitamin C & Niacinamide Serum' },
            { name: 'Clay Mask', brands: 'Innisfree Super Volcanic Pore Clay Mask (Nykaa), Mamaearth Charcoal Face Mask, Lotus Herbals Claywhite Black Clay Face Pack, WOW Skin Science Activated Charcoal Face Mask' }
          ]
        },
        pores: {
          name: 'Pores',
          icon: '🔍',
          getScore: (a) => Math.min(100, (a.enlarged_pores_count || 0) * 8 + 15),
          isGood: false,
          getProblem: (a, score) => {
            const count = a.enlarged_pores_count || 0;
            if (score < 30) return 'Pores appear minimal and refined.';
            if (score < 60) return `${count} enlarged pores visible, mainly in the T-zone area.`;
            return `${count} visibly enlarged pores detected. This is often related to oiliness and can trap debris.`;
          },
          getSolution: (a, score) => {
            if (score < 30) return 'Continue cleansing properly and using SPF to prevent pore enlargement.';
            return 'Use BHA (Salicylic Acid) to clean inside pores. Try Niacinamide to tighten appearance. Use non-comedogenic products and consider regular clay masks.';
          },
          getIngredients: () => 'Salicylic Acid (BHA), Niacinamide, Kaolin/Bentonite Clay, Retinol, Alpha Hydroxy Acids (AHA), Witch Hazel',
          getUsage: () => 'Use BHA toner 2-3x/week at night. Apply to clean skin, wait 20 mins before next step. Use clay mask on nose/chin 1-2x weekly (15 mins max). Double cleanse at night with oil cleanser followed by water-based cleanser.',
          getProducts: () => [
            { name: 'BHA Exfoliant', brands: 'Minimalist 2% Salicylic Acid Serum, COSRX BHA Blackhead Power Liquid (Nykaa), Deconstruct 2% Salicylic Acid Serum, Re\'equil Fruit AHA Face Wash' },
            { name: 'Pore-Minimizing Serum', brands: 'Minimalist 10% Niacinamide + Zinc, The Ordinary Niacinamide 10% + Zinc 1% (Nykaa), Dot & Key CICA Calming Niacinamide Serum, Pilgrim Niacinamide & Zinc Serum' },
            { name: 'Oil Cleanser', brands: 'Innisfree Apple Seed Cleansing Oil (Nykaa), Plum E-Luminence Deep Cleansing Oil, Kama Ayurveda Rose Jasmine Face Cleanser, Forest Essentials Makeup Remover Oil' }
          ]
        },
        texture: {
          name: 'Skin Texture',
          icon: '💎',
          getScore: (a) => a.texture_score || a.smoothness_score || 0,
          isGood: true,
          getProblem: (a, score) => {
            if (score > 70) return 'Smooth, refined skin texture detected. Your skin looks healthy and even.';
            if (score > 40) return 'Some texture irregularities visible. Minor bumps or rough patches may be present.';
            return 'Uneven texture detected with visible bumps, roughness, or scarring.';
          },
          getSolution: (a, score) => {
            if (score > 70) return 'Maintain your exfoliation routine. Use gentle products to keep skin smooth.';
            return 'Incorporate AHA (Glycolic/Lactic Acid) for surface exfoliation. Use a gentle physical exfoliant 1-2x weekly. Retinol can help smooth texture over time.';
          },
          getIngredients: () => 'Glycolic Acid (AHA), Lactic Acid, Mandelic Acid, Retinol, Niacinamide, Polyhydroxy Acids (PHA), Enzyme Exfoliants',
          getUsage: () => 'Use AHA exfoliant 2-3x/week at night on clean skin. Start with lower concentrations (5-8%) and increase gradually. Never use with retinol on same night. Follow with hydrating serum and moisturizer. Always use SPF next day.',
          getProducts: () => [
            { name: 'AHA Exfoliating Toner', brands: 'The Ordinary Glycolic Acid 7% Toning Solution (Nykaa), Minimalist 10% Lactic Acid Serum, Pixi Glow Tonic (Nykaa), Plum 1% Glycolic Acid Toner' },
            { name: 'Resurfacing Serum', brands: 'Minimalist 25% AHA + 2% BHA Peeling Solution, The Ordinary AHA 30% + BHA 2% Peeling Solution (Nykaa), Deconstruct AHA + BHA Exfoliating Serum, Dot & Key 10% AHA Exfoliating Serum' },
            { name: 'Smoothing Moisturizer', brands: 'CeraVe SA Cream for Rough & Bumpy Skin (Nykaa), Minimalist 0.3% Ceramide Moisturizer, Neutrogena Norwegian Formula Body Emulsion, Dermaco 1% Salicylic Acid Gel Moisturizer' }
          ]
        }
      };
    }

    generateAttributeCards(analysis) {
      const container = document.getElementById('flashai-vto-attribute-cards');
      if (!container || !analysis) return;

      const attributes = this.getAttributeDefinitions();

      // Sort attributes by severity (highest score first for problem attributes)
      const sortedAttrs = Object.entries(attributes).sort(([, a], [, b]) => {
        const scoreA = a.getScore(analysis);
        const scoreB = b.getScore(analysis);
        // For "isGood" attributes, lower is worse; for others, higher is worse
        const severityA = a.isGood ? (100 - scoreA) : scoreA;
        const severityB = b.isGood ? (100 - scoreB) : scoreB;
        return severityB - severityA;
      });

      container.innerHTML = sortedAttrs.map(([key, attr]) => {
        const score = attr.getScore(analysis);

        // Determine severity level for styling
        let severity, severityLabel;
        if (attr.isGood) {
          severity = score > 70 ? 'good' : score > 40 ? 'moderate' : 'concern';
          severityLabel = score > 70 ? 'Good' : score > 40 ? 'Moderate' : 'Needs Care';
        } else {
          severity = score < 30 ? 'good' : score < 60 ? 'moderate' : 'concern';
          severityLabel = score < 30 ? 'Good' : score < 60 ? 'Moderate' : 'Needs Care';
        }

        return `
          <div class="flashai-vto-attribute-card" data-attribute="${key}" data-severity="${severity}">
            <div class="flashai-vto-card-icon-wrap ${severity}">
              <span class="flashai-vto-card-icon">${attr.icon}</span>
            </div>
            <div class="flashai-vto-card-info">
              <h4>${attr.name}</h4>
              <div class="flashai-vto-card-score-bar">
                <div class="flashai-vto-score-fill ${severity}" style="width: ${Math.round(score)}%"></div>
              </div>
              <span class="flashai-vto-card-severity ${severity}">${severityLabel}</span>
            </div>
            <div class="flashai-vto-card-value ${severity}">${Math.round(score)}%</div>
          </div>
        `;
      }).join('');

      // Add click handlers to cards
      container.querySelectorAll('.flashai-vto-attribute-card').forEach(card => {
        card.addEventListener('click', () => {
          const attr = card.dataset.attribute;
          this.selectAttribute(attr);
        });
      });

      // Select first card by default (most concerning)
      if (sortedAttrs.length > 0) {
        setTimeout(() => this.selectAttribute(sortedAttrs[0][0]), 100);
      }
    }

    drawFaceOutlineOnCanvas(ctx, analysis, w, h) {
      const faceOutline = analysis?.face_outline;
      if (!faceOutline || faceOutline.length < 3) return;

      ctx.strokeStyle = 'rgba(147, 51, 234, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();

      faceOutline.forEach((point, i) => {
        const x = point[0] * w;
        const y = point[1] * h;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.closePath();
      ctx.stroke();
    }

    drawDarkCirclesOverlay(ctx, analysis, w, h, enhanced = false) {
      const regions = analysis.dark_circles_regions;
      if (!regions) return;

      const alpha = enhanced ? 0.5 : 0.35;
      ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
      ctx.strokeStyle = enhanced ? 'rgba(147, 51, 234, 1)' : 'rgba(147, 51, 234, 0.8)';
      ctx.lineWidth = enhanced ? 3 : 2;

      ['left_eye', 'right_eye'].forEach(eye => {
        const region = regions[eye];
        if (region && region.bbox) {
          const [x1, y1, x2, y2] = region.bbox;
          const rx = x1 * w;
          const ry = y1 * h;
          const rw = (x2 - x1) * w;
          const rh = (y2 - y1) * h;

          // Draw rounded rectangle
          ctx.beginPath();
          ctx.roundRect(rx, ry, rw, rh, 6);
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    drawPoresOverlay(ctx, analysis, w, h, enhanced = false) {
      const pores = analysis.enlarged_pores_locations || [];

      // Draw T-zone highlight
      const alpha = enhanced ? 0.2 : 0.12;
      ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
      ctx.fillRect(0.35 * w, 0.15 * h, 0.3 * w, 0.55 * h);

      // Draw pore markers
      const dotSize = enhanced ? 6 : 4;
      pores.forEach(pore => {
        ctx.fillStyle = enhanced ? 'rgba(255, 180, 0, 1)' : 'rgba(255, 200, 0, 0.9)';
        ctx.strokeStyle = enhanced ? 'rgba(180, 120, 0, 1)' : 'rgba(200, 150, 0, 1)';
        ctx.lineWidth = enhanced ? 2 : 1;
        ctx.beginPath();
        ctx.arc(pore.x * w, pore.y * h, dotSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    drawWrinklesOverlay(ctx, analysis, w, h, enhanced = false) {
      const regions = analysis.wrinkle_regions;
      if (!regions) return;

      Object.entries(regions).forEach(([name, region]) => {
        if (region && region.bbox && region.severity > 0.1) {
          const [x1, y1, x2, y2] = region.bbox;
          const baseIntensity = Math.min(0.4, region.severity * 0.5);
          const intensity = enhanced ? Math.min(0.6, baseIntensity + 0.2) : baseIntensity;

          ctx.fillStyle = `rgba(147, 51, 234, ${intensity})`;
          ctx.strokeStyle = enhanced ? 'rgba(147, 51, 234, 1)' : 'rgba(147, 51, 234, 0.7)';
          ctx.lineWidth = enhanced ? 2 : 1;

          ctx.beginPath();
          ctx.roundRect(x1 * w, y1 * h, (x2 - x1) * w, (y2 - y1) * h, 4);
          ctx.fill();
          ctx.stroke();

          // Draw lines pattern for wrinkles
          ctx.strokeStyle = enhanced ? 'rgba(147, 51, 234, 0.8)' : 'rgba(147, 51, 234, 0.5)';
          ctx.lineWidth = enhanced ? 2 : 1;
          for (let i = 0; i < 3; i++) {
            const ly = y1 * h + ((y2 - y1) * h * (i + 1)) / 4;
            ctx.beginPath();
            ctx.moveTo(x1 * w + 4, ly);
            ctx.lineTo(x2 * w - 4, ly);
            ctx.stroke();
          }
        }
      });
    }

    drawAcneOverlay(ctx, analysis, w, h, enhanced = false) {
      const acneLocations = analysis.acne_locations || [];

      // Draw acne spots as colored dots
      acneLocations.forEach(spot => {
        const baseSize = spot.size === 'large' ? 6 : spot.size === 'medium' ? 4 : 3;
        const size = enhanced ? baseSize + 2 : baseSize;

        if (enhanced) {
          // Add glow effect when enhanced
          ctx.shadowColor = spot.type === 'pimple' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 200, 0, 0.5)';
          ctx.shadowBlur = 8;
        }

        ctx.fillStyle = spot.type === 'pimple'
          ? (enhanced ? 'rgba(239, 68, 68, 1)' : 'rgba(239, 68, 68, 0.8)')
          : (enhanced ? 'rgba(255, 180, 0, 1)' : 'rgba(255, 200, 0, 0.9)');
        ctx.strokeStyle = enhanced ? '#fff' : 'transparent';
        ctx.lineWidth = enhanced ? 2 : 0;

        ctx.beginPath();
        ctx.arc(spot.x * w, spot.y * h, size, 0, Math.PI * 2);
        ctx.fill();
        if (enhanced) ctx.stroke();

        ctx.shadowBlur = 0;
      });
    }

    drawRednessOverlay(ctx, analysis, w, h, enhanced = false) {
      const regions = analysis.redness_regions || [];

      const alpha = enhanced ? 0.4 : 0.25;
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.strokeStyle = enhanced ? 'rgba(239, 68, 68, 0.8)' : 'transparent';
      ctx.lineWidth = enhanced ? 2 : 0;

      regions.forEach(region => {
        if (region.bbox) {
          const [x1, y1, x2, y2] = region.bbox;
          ctx.beginPath();
          ctx.roundRect(x1 * w, y1 * h, (x2 - x1) * w, (y2 - y1) * h, 8);
          ctx.fill();
          if (enhanced) ctx.stroke();
        }
      });
    }

    drawTZoneOverlay(ctx, w, h, enhanced = false) {
      // T-zone: forehead + nose area
      const alpha = enhanced ? 0.35 : 0.2;
      ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
      ctx.strokeStyle = enhanced ? 'rgba(147, 51, 234, 0.8)' : 'transparent';
      ctx.lineWidth = enhanced ? 2 : 0;

      // Forehead
      ctx.beginPath();
      ctx.roundRect(0.25 * w, 0.08 * h, 0.5 * w, 0.17 * h, 8);
      ctx.fill();
      if (enhanced) ctx.stroke();

      // Nose
      ctx.beginPath();
      ctx.roundRect(0.38 * w, 0.25 * h, 0.24 * w, 0.45 * h, 8);
      ctx.fill();
      if (enhanced) ctx.stroke();
    }

    drawPigmentationOverlay(ctx, analysis, w, h, enhanced = false) {
      const spots = analysis.dark_spots_locations || [];

      // Draw dark spots
      spots.forEach(spot => {
        const baseSize = Math.max(3, Math.min(8, spot.size * 50));
        const size = enhanced ? baseSize + 2 : baseSize;

        if (enhanced) {
          ctx.shadowColor = 'rgba(139, 69, 19, 0.5)';
          ctx.shadowBlur = 6;
        }

        ctx.fillStyle = enhanced ? 'rgba(139, 69, 19, 0.9)' : 'rgba(139, 69, 19, 0.7)';
        ctx.strokeStyle = enhanced ? '#fff' : 'transparent';
        ctx.lineWidth = enhanced ? 2 : 0;

        ctx.beginPath();
        ctx.arc(spot.x * w, spot.y * h, size, 0, Math.PI * 2);
        ctx.fill();
        if (enhanced) ctx.stroke();

        ctx.shadowBlur = 0;
      });
    }

    drawFullFaceHighlight(ctx, w, h, color) {
      const analysis = this.state.currentAnalysis;
      const faceOutline = analysis?.face_outline;

      if (!faceOutline || faceOutline.length < 3) {
        // Fallback: draw oval
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.45, w * 0.3, h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.fillStyle = color;
      ctx.beginPath();

      faceOutline.forEach((point, i) => {
        const x = point[0] * w;
        const y = point[1] * h;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.closePath();
      ctx.fill();
    }

    drawTextureOverlay(ctx, w, h, analysis, enhanced = false) {
      // Highlight cheeks and forehead where texture is most visible
      const fillAlpha = enhanced ? 0.25 : 0.15;
      const strokeAlpha = enhanced ? 0.8 : 0.5;
      ctx.fillStyle = `rgba(16, 185, 129, ${fillAlpha})`;
      ctx.strokeStyle = `rgba(16, 185, 129, ${strokeAlpha})`;
      ctx.lineWidth = enhanced ? 2 : 1;

      // Left cheek
      ctx.beginPath();
      ctx.ellipse(0.25 * w, 0.5 * h, 0.12 * w, 0.15 * h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Right cheek
      ctx.beginPath();
      ctx.ellipse(0.75 * w, 0.5 * h, 0.12 * w, 0.15 * h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Forehead
      ctx.beginPath();
      ctx.ellipse(0.5 * w, 0.2 * h, 0.2 * w, 0.1 * h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    async loadProductRecommendations(scanId) {
      try {
        // Face scan uses /api/face-scan instead of /api/vto
        const faceScanBaseUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/face-scan');

        const response = await fetch(`${faceScanBaseUrl}/recommendations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({
            scanId: scanId
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load recommendations');
        }

        this.displayProductRecommendations(data.data.recommendations);
      } catch (error) {
        console.error('Load recommendations error:', error);
        const container = document.getElementById('flashai-vto-recommendations');
        if (container) {
          container.innerHTML = '<p class="flashai-vto-error-text">Failed to load recommendations</p>';
        }
      }
    }

    displayProductRecommendations(recommendations) {
      const container = document.getElementById('flashai-vto-recommendations');
      if (!container) return;

      if (!recommendations || recommendations.length === 0) {
        container.innerHTML = '<p class="flashai-vto-no-products">No recommendations available yet. Check back soon!</p>';
        return;
      }

      // Group recommendations by type for better UX
      const typeLabels = {
        'pigmentation_treatment': '🎯 For Dark Spots',
        'pigmentation_prevention': '☀️ Sun Protection',
        'acne_treatment': '✨ For Blemishes',
        'anti_aging': '⏳ Anti-Aging',
        'hydration': '💧 Hydration',
        'oil_control': '🧴 Oil Control',
        'redness_relief': '🌸 Calming',
        'texture_improvement': '💎 Texture',
        'skin_tone_match': '🎨 Your Shade',
        'complementary': '💄 Color Match',
        'general': '✨ For You'
      };

      container.innerHTML = `
        <div class="flashai-vto-product-grid">
          ${recommendations.slice(0, 8).map(rec => {
            const typeLabel = typeLabels[rec.recommendation_type] || typeLabels['general'];
            const ingredients = rec.reason && rec.reason.includes('Key ingredients:')
              ? rec.reason.split('Key ingredients:')[1]?.split('.')[0]?.trim()
              : '';
            return `
              <div class="flashai-vto-product-card" data-product-id="${rec.product_id}">
                <div class="flashai-vto-product-type-badge">${typeLabel}</div>
                <img src="${rec.product_image_url || ''}" alt="${rec.product_title || 'Product'}" onerror="this.style.display='none'">
                <div class="flashai-vto-product-info">
                  <h4>${rec.product_title || 'Product'}</h4>
                  <p class="flashai-vto-product-reason">${rec.reason?.split('.')[0] || ''}</p>
                  ${ingredients ? `<p class="flashai-vto-product-ingredients">🧪 ${ingredients}</p>` : ''}
                  <div class="flashai-vto-product-footer">
                    <span class="flashai-vto-product-price">$${rec.product_price || '0.00'}</span>
                    <span class="flashai-vto-product-confidence">${Math.round((rec.confidence_score || 0) * 100)}% match</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Add click handlers for products
      container.querySelectorAll('.flashai-vto-product-card').forEach((card, index) => {
        card.addEventListener('click', () => {
          const rec = recommendations[index];
          if (rec.product_id) {
            this.trackEvent('product_clicked', {
              scanId: this.state.faceScanId,
              productId: rec.product_id
            });
            window.open(`/products/${rec.product_id}`, '_blank');
          }
        });
      });
    }

    generateSkinSummary(analysis) {
      console.log('[SkinSummary] Generating summary for:', analysis);

      const concernsContainer = document.getElementById('flashai-vto-summary-concerns');
      const tipsContainer = document.getElementById('flashai-vto-summary-tips');

      console.log('[SkinSummary] Containers found:', { concerns: !!concernsContainer, tips: !!tipsContainer });

      if (!concernsContainer || !tipsContainer) {
        console.warn('[SkinSummary] Container elements not found!');
        return;
      }

      // Analyze and prioritize concerns based on scores
      const concerns = [];
      const tips = [];

      // Check each metric and create customer-friendly messages
      // Pigmentation
      if (analysis.pigmentation_score > 40) {
        concerns.push({
          icon: '☀️',
          title: 'Sun Damage & Dark Spots',
          severity: analysis.pigmentation_score > 60 ? 'high' : 'moderate',
          description: analysis.dark_spots_count > 5
            ? `We detected ${analysis.dark_spots_count} dark spots that could benefit from brightening care.`
            : 'Some uneven skin tone that brightening products can help improve.'
        });
        tips.push('Use SPF 30+ daily to prevent further sun damage');
        tips.push('Look for Vitamin C or Niacinamide to brighten dark spots');
      }

      // Acne
      if (analysis.acne_score > 30) {
        const blemishCount = (analysis.whitehead_count || 0) + (analysis.blackhead_count || 0) + (analysis.pimple_count || 0);
        concerns.push({
          icon: '🎯',
          title: 'Blemishes & Breakouts',
          severity: analysis.acne_score > 50 ? 'high' : 'moderate',
          description: blemishCount > 0
            ? `${blemishCount} active blemishes detected. Targeted treatment can help clear your skin.`
            : 'Some congestion detected that gentle exfoliation can help with.'
        });
        tips.push('Try Salicylic Acid or Tea Tree for blemish control');
        tips.push('Keep skin clean but avoid over-washing');
      }

      // Wrinkles & Fine Lines
      if (analysis.wrinkle_score > 25) {
        concerns.push({
          icon: '✨',
          title: 'Fine Lines & Wrinkles',
          severity: analysis.wrinkle_score > 50 ? 'high' : 'moderate',
          description: analysis.deep_wrinkles_count > 0
            ? `Some expression lines and ${analysis.deep_wrinkles_count} deeper wrinkles detected.`
            : 'Early signs of fine lines that anti-aging care can address.'
        });
        tips.push('Retinol is excellent for reducing fine lines');
        tips.push('Hydration helps plump skin and minimize wrinkle appearance');
      }

      // Texture
      if (analysis.texture_score < 60) {
        concerns.push({
          icon: '💎',
          title: 'Uneven Texture',
          severity: analysis.texture_score < 40 ? 'high' : 'moderate',
          description: analysis.enlarged_pores_count > 10
            ? `Enlarged pores and rough texture detected. Exfoliation can help smooth your skin.`
            : 'Some texture irregularities that gentle exfoliation can improve.'
        });
        tips.push('AHA/BHA exfoliants help smooth skin texture');
        tips.push('Niacinamide helps minimize pore appearance');
      }

      // Redness & Sensitivity
      if (analysis.redness_score > 35) {
        concerns.push({
          icon: '🌸',
          title: 'Redness & Sensitivity',
          severity: analysis.redness_score > 55 ? 'high' : 'moderate',
          description: analysis.rosacea_indicators
            ? 'Signs of persistent redness detected. Gentle, calming products are recommended.'
            : 'Some skin sensitivity and redness that soothing ingredients can help calm.'
        });
        tips.push('Centella (Cica) and Aloe are great for calming redness');
        tips.push('Avoid harsh ingredients and fragrance');
      }

      // Hydration
      const hydrationLevel = (analysis.hydration_level || '').toLowerCase();
      if (hydrationLevel === 'dry' || analysis.hydration_score < 45) {
        concerns.push({
          icon: '💧',
          title: 'Dehydrated Skin',
          severity: analysis.hydration_score < 35 ? 'high' : 'moderate',
          description: analysis.dry_patches_detected
            ? 'Dry patches and dehydration detected. Your skin is craving moisture!'
            : 'Your skin could use more hydration for a healthy, plump appearance.'
        });
        tips.push('Hyaluronic Acid provides deep, long-lasting hydration');
        tips.push('Use a rich moisturizer, especially at night');
      } else if (hydrationLevel === 'oily' || analysis.oiliness_score > 65) {
        concerns.push({
          icon: '🧴',
          title: 'Excess Oil',
          severity: analysis.oiliness_score > 80 ? 'high' : 'moderate',
          description: 'Your skin produces more oil, especially in the T-zone. Oil-control products can help balance.'
        });
        tips.push('Use oil-free, non-comedogenic products');
        tips.push('Niacinamide helps regulate oil production');
      }

      // If skin is in good condition
      if (concerns.length === 0) {
        concerns.push({
          icon: '✅',
          title: 'Great Skin Health!',
          severity: 'good',
          description: 'Your skin looks healthy! Focus on maintaining with good skincare basics.'
        });
        tips.push('Continue with sun protection and hydration');
        tips.push('A simple routine is best for healthy skin');
      }

      // Render concerns
      concernsContainer.innerHTML = concerns.map(concern => `
        <div class="flashai-vto-concern-card ${concern.severity}">
          <div class="flashai-vto-concern-icon">${concern.icon}</div>
          <div class="flashai-vto-concern-content">
            <h4>${concern.title}</h4>
            <p>${concern.description}</p>
          </div>
        </div>
      `).join('');

      // Render tips (top 3)
      tipsContainer.innerHTML = `
        <h4>💡 Skincare Tips for You</h4>
        <ul>
          ${tips.slice(0, 4).map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      `;

      console.log('[SkinSummary] Rendered', concerns.length, 'concerns and', tips.length, 'tips');
    }

    shopRecommendedProducts() {
      // Scroll to products or redirect to collection page
      this.trackEvent('shop_recommendations_clicked', {
        scanId: this.state.faceScanId
      });

      // Close modal and scroll to products
      this.closeModal();

      // Optionally scroll to product collection
      const productsSection = document.querySelector('.products, .collection, #products');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth' });
      }
    }

    // ==========================================================================
    // Virtual Try-On
    // ==========================================================================

    async initializeTryOn() {
      try {
        // Start try-on session
        const response = await fetch(`${this.config.apiBaseUrl}/try-on/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({
            bodyScanId: this.state.bodyScan.scan.id,
            productId: this.config.productId,
            variantId: this.config.variantId,
            visitorId: this.state.visitorId
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to start try-on session');
        }

        this.state.session = data.data;

        // Get size recommendation
        await this.getSizeRecommendation();

        // Initialize 3D renderer (placeholder for now)
        this.initializeRenderer();
      } catch (error) {
        console.error('Initialize try-on error:', error);
        this.showError(error.message || 'Failed to initialize try-on. Please try again.');
      }
    }

    async getSizeRecommendation() {
      try {
        const response = await fetch(
          `${this.config.apiBaseUrl}/size-recommendation?bodyScanId=${this.state.bodyScan.scan.id}&productId=${this.config.productId}`,
          {
            headers: {
              'X-API-Key': this.config.apiKey
            }
          }
        );

        const data = await response.json();

        if (data.success) {
          const rec = data.data;
          document.getElementById('flashai-vto-size').textContent = rec.recommended_size;
          document.getElementById('flashai-vto-confidence').textContent =
            `${Math.round(rec.confidence * 100)}% confidence`;
          document.getElementById('flashai-vto-fit-advice-text').textContent = rec.fit_advice;
        }
      } catch (error) {
        console.error('Size recommendation error:', error);
      }
    }

    initializeRenderer() {
      try {
        const canvas = document.getElementById('flashai-vto-canvas');

        // Check if Three.js is loaded
        if (typeof THREE === 'undefined') {
          console.error('Three.js not loaded, showing fallback');
          this.showFallbackRenderer(canvas);
          return;
        }

        // Check if VTO3DRenderer is loaded
        if (typeof VTO3DRenderer === 'undefined') {
          console.error('VTO3DRenderer not loaded, showing fallback');
          this.showFallbackRenderer(canvas);
          return;
        }

        // Initialize 3D renderer
        this.renderer = new VTO3DRenderer(canvas, {
          backgroundColor: 0xf5f5f5,
          enableControls: true,
          autoRotate: false
        });

        // Load body mesh if available
        if (this.state.bodyScan && this.state.bodyScan.scan.mesh_url) {
          this.renderer.loadBodyMesh(this.state.bodyScan.scan.mesh_url)
            .then(() => {
              console.log('Body mesh loaded successfully');
              // Hide loader
              document.getElementById('flashai-vto-canvas-loader').style.display = 'none';
            })
            .catch((error) => {
              console.error('Failed to load body mesh:', error);
              this.showFallbackRenderer(canvas);
            });
        } else {
          // No mesh available, show fallback
          this.showFallbackRenderer(canvas);
        }

        // Load garment mesh if available
        if (this.state.session && this.state.session.renderData && this.state.session.renderData.garment_mesh_url) {
          this.renderer.loadGarmentMesh(this.state.session.renderData.garment_mesh_url)
            .then(() => {
              console.log('Garment mesh loaded successfully');
            })
            .catch((error) => {
              console.warn('Failed to load garment mesh:', error);
            });
        }
      } catch (error) {
        console.error('Renderer initialization error:', error);
        this.showFallbackRenderer(document.getElementById('flashai-vto-canvas'));
      }
    }

    showFallbackRenderer(canvas) {
      // Hide loader
      const loader = document.getElementById('flashai-vto-canvas-loader');
      if (loader) {
        loader.style.display = 'none';
      }

      // Show fallback 2D canvas
      const ctx = canvas.getContext('2d');

      canvas.width = 800;
      canvas.height = 600;

      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#333';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('3D Viewer', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '16px Arial';
      ctx.fillText('Your body scan is ready!', canvas.width / 2, canvas.height / 2 + 20);
      ctx.fillText('(3D rendering requires Three.js library)', canvas.width / 2, canvas.height / 2 + 50);
    }

    // ==========================================================================
    // Actions
    // ==========================================================================

    async takeScreenshot() {
      try {
        const canvas = document.getElementById('flashai-vto-canvas');
        canvas.toBlob(async blob => {
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result;

            await fetch(`${this.config.apiBaseUrl}/try-on/${this.state.session.sessionId}/screenshot`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.config.apiKey
              },
              body: JSON.stringify({ imageData: base64 })
            });

            alert('Screenshot saved!');
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Screenshot error:', error);
        alert('Failed to save screenshot');
      }
    }

    async shareSocial() {
      try {
        await fetch(`${this.config.apiBaseUrl}/try-on/${this.state.session.sessionId}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({ platform: 'generic' })
        });

        // Simple share functionality
        if (navigator.share) {
          await navigator.share({
            title: 'Check out my virtual try-on!',
            text: 'I just tried on this product virtually!',
            url: window.location.href
          });
        } else {
          alert('Share this page: ' + window.location.href);
        }
      } catch (error) {
        console.error('Share error:', error);
      }
    }

    addToCart() {
      // Get recommended size
      const size = document.getElementById('flashai-vto-size').textContent;

      // Trigger add to cart (platform-specific)
      // For Shopify:
      if (typeof window.ShopifyAnalytics !== 'undefined') {
        // Add to cart via Shopify
        alert(`Adding to cart with size ${size} (Shopify integration pending)`);
      } else {
        alert(`Recommended size: ${size}\nClick your store's Add to Cart button to purchase.`);
      }

      // Close modal
      this.closeModal();
    }

    // ==========================================================================
    // Helpers
    // ==========================================================================

    showError(message) {
      this.showStep('error');
      document.getElementById('flashai-vto-error-message').textContent = message;
    }

    getOrCreateVisitorId() {
      let visitorId = localStorage.getItem('flashai_vto_visitor_id');
      if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('flashai_vto_visitor_id', visitorId);
      }
      return visitorId;
    }

    capitalizeFirst(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    extractProductId() {
      // Try to extract from URL
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('product_id') || urlParams.get('id');
      if (productId) return productId;

      // Try to find in page data
      const productElement = document.querySelector('[data-product-id]');
      if (productElement) return productElement.dataset.productId;

      // Try Shopify meta
      const shopifyMeta = document.querySelector('meta[property="og:url"]');
      if (shopifyMeta) {
        const url = shopifyMeta.content;
        const match = url.match(/products\/([^\/\?]+)/);
        if (match) return match[1];
      }

      return null;
    }

    observeProductChanges() {
      // Watch for product page changes (for SPAs)
      let lastUrl = window.location.href;

      const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          this.config.productId = this.extractProductId();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    async trackEvent(eventType, data = {}) {
      try {
        // Face scan uses /api/face-scan instead of /api/vto
        const faceScanBaseUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/face-scan');

        await fetch(`${faceScanBaseUrl}/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({
            eventType,
            visitorId: this.state.visitorId,
            ...data
          })
        });
      } catch (error) {
        console.error('Track event error:', error);
        // Don't throw - tracking failures shouldn't break UX
      }
    }

    // ==========================================================================
    // Treatment Prioritization, Timeline & Healthcare Recommendations
    // ==========================================================================

    renderTreatmentPriority(analysis) {
      const container = document.getElementById('flashai-vto-priority-list');
      if (!container || !analysis) return;

      // Define treatment priority rules (what to fix first)
      const priorities = [
        {
          key: 'acne',
          name: 'Clear Breakouts First',
          score: analysis.acne_score || 0,
          threshold: 25,
          icon: '🎯',
          why: 'Active breakouts need immediate attention to prevent scarring',
          products: 'Salicylic Acid cleanser, Benzoyl Peroxide spot treatment',
          usage: 'Cleanse AM/PM, spot treat at night'
        },
        {
          key: 'redness',
          name: 'Calm Inflammation',
          score: analysis.redness_score || 0,
          threshold: 30,
          icon: '🌸',
          why: 'Reduce redness and sensitivity before using active ingredients',
          products: 'Centella (Cica) serum, Azelaic Acid',
          usage: 'Apply soothing serum AM/PM after cleansing'
        },
        {
          key: 'hydration',
          name: 'Repair Skin Barrier',
          score: 100 - (analysis.hydration_score || 65),
          threshold: 35,
          icon: '💧',
          why: 'A healthy barrier is essential for other treatments to work',
          products: 'Hyaluronic Acid serum, Ceramide moisturizer',
          usage: 'Apply on damp skin AM/PM, seal with moisturizer'
        },
        {
          key: 'pigmentation',
          name: 'Fade Dark Spots',
          score: analysis.pigmentation_score || 0,
          threshold: 25,
          icon: '☀️',
          why: 'Once skin is calm, focus on evening skin tone',
          products: 'Vitamin C serum (AM), Niacinamide, SPF 50',
          usage: 'Vitamin C in morning, Niacinamide at night'
        },
        {
          key: 'wrinkles',
          name: 'Address Fine Lines',
          score: analysis.wrinkle_score || 0,
          threshold: 20,
          icon: '✨',
          why: 'Anti-aging treatments work best on healthy, calm skin',
          products: 'Retinol serum, Peptide cream',
          usage: 'Start 2x/week at night, increase gradually'
        },
        {
          key: 'texture',
          name: 'Refine Texture',
          score: 100 - (analysis.texture_score || 70),
          threshold: 30,
          icon: '💎',
          why: 'Exfoliation for smoother skin after other concerns are managed',
          products: 'AHA/BHA exfoliant, Niacinamide for pores',
          usage: 'Exfoliate 2-3x/week, not with retinol'
        }
      ];

      // Filter and sort by score (highest issues first)
      const activeIssues = priorities
        .filter(p => p.score >= p.threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4); // Show top 4 priorities

      if (activeIssues.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:12px;background:#dcfce7;border-radius:8px;">
            <span style="font-size:24px;">✨</span>
            <p style="margin:8px 0 0;font-size:13px;color:#166534;">Your skin is in great condition! Focus on maintenance with SPF and hydration.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = activeIssues.map((issue, index) => `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#fff;border-radius:8px;border:1px solid #fde68a;">
          <div style="width:32px;height:32px;border-radius:50%;background:${index === 0 ? '#dc2626' : index === 1 ? '#f59e0b' : '#3b82f6'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0;">
            ${index + 1}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span style="font-size:16px;">${issue.icon}</span>
              <span style="font-weight:700;font-size:13px;color:#1f2937;">${issue.name}</span>
            </div>
            <p style="font-size:11px;color:#6b7280;margin:0 0 6px;line-height:1.4;">${issue.why}</p>
            <div style="background:#f9fafb;padding:8px;border-radius:6px;margin-top:6px;">
              <p style="font-size:10px;font-weight:600;color:#374151;margin:0 0 2px;">📦 Products: <span style="font-weight:400;">${issue.products}</span></p>
              <p style="font-size:10px;font-weight:600;color:#374151;margin:0;">⏰ Usage: <span style="font-weight:400;">${issue.usage}</span></p>
            </div>
          </div>
        </div>
      `).join('');
    }

    renderSkincareTimeline(analysis) {
      const container = document.getElementById('flashai-vto-timeline-content');
      if (!container || !analysis) return;

      // Determine primary concerns for personalized timeline
      const hasAcne = (analysis.acne_score || 0) > 25;
      const hasRedness = (analysis.redness_score || 0) > 30;
      const hasDehydration = (analysis.hydration_score || 65) < 50;
      const hasPigmentation = (analysis.pigmentation_score || 0) > 25;
      const hasWrinkles = (analysis.wrinkle_score || 0) > 20;

      const timeline = [
        {
          period: 'Month 1',
          title: 'Foundation Phase',
          icon: '🌱',
          focus: 'Build your basic routine',
          tasks: [
            'Start with gentle cleanser AM/PM',
            hasDehydration ? 'Add Hyaluronic Acid serum daily' : 'Use a lightweight moisturizer',
            'Apply SPF 30+ every morning (non-negotiable!)',
            hasAcne ? 'Introduce Salicylic Acid cleanser 3x/week' : 'Keep routine simple',
            hasRedness ? 'Use fragrance-free products only' : ''
          ].filter(Boolean)
        },
        {
          period: 'Months 1-3',
          title: 'Treatment Phase',
          icon: '🔬',
          focus: 'Add targeted treatments',
          tasks: [
            hasAcne ? 'Continue acne treatment, add spot treatment' : 'Maintain cleansing routine',
            hasPigmentation ? 'Introduce Vitamin C serum (AM)' : 'Add antioxidant serum',
            hasRedness ? 'Add Centella/Cica products for calming' : '',
            'Upgrade to SPF 50 if using actives',
            hasWrinkles ? 'Start Retinol 2x/week at night (pea-sized)' : ''
          ].filter(Boolean)
        },
        {
          period: 'Months 3-6',
          title: 'Optimization Phase',
          icon: '📈',
          focus: 'Increase strength & frequency',
          tasks: [
            hasWrinkles ? 'Increase Retinol to 3-4x/week' : 'Consider adding gentle retinol',
            hasPigmentation ? 'Add Niacinamide for enhanced brightening' : 'Continue Vitamin C',
            hasAcne ? 'Transition to maintenance (less frequent acids)' : '',
            'Add weekly exfoliation (AHA or enzyme mask)',
            'Evaluate progress - adjust products if needed'
          ].filter(Boolean)
        },
        {
          period: 'Months 6-9',
          title: 'Advanced Care',
          icon: '⭐',
          focus: 'Fine-tune your routine',
          tasks: [
            'Consider professional treatments (facials, peels)',
            hasWrinkles ? 'Increase Retinol strength or add Peptides' : 'Add anti-aging preventive care',
            'Try overnight masks for deep hydration',
            'Reassess and adjust based on seasonal changes',
            hasPigmentation ? 'Consider Alpha Arbutin for stubborn spots' : ''
          ].filter(Boolean)
        },
        {
          period: 'Months 9-12',
          title: 'Maintenance Mode',
          icon: '🏆',
          focus: 'Maintain your results',
          tasks: [
            'Continue your established routine',
            'Re-scan your skin to track improvements',
            'Adjust products seasonally (lighter in summer)',
            'Book annual dermatologist check-up',
            'Celebrate your skin transformation! 🎉'
          ]
        }
      ];

      container.innerHTML = timeline.map((phase, index) => `
        <div style="position:relative;padding-left:24px;">
          ${index < timeline.length - 1 ? '<div style="position:absolute;left:8px;top:24px;bottom:-10px;width:2px;background:linear-gradient(to bottom,#8b5cf6,#ddd6fe);"></div>' : ''}
          <div style="position:absolute;left:0;top:4px;width:18px;height:18px;border-radius:50%;background:${index === 0 ? '#8b5cf6' : '#e9d5ff'};display:flex;align-items:center;justify-content:center;font-size:10px;">${index === 0 ? '●' : ''}</div>
          <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #e5e7eb;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-size:16px;">${phase.icon}</span>
              <div>
                <span style="font-weight:700;font-size:12px;color:#5b21b6;">${phase.period}</span>
                <span style="font-weight:600;font-size:12px;color:#1f2937;margin-left:8px;">${phase.title}</span>
              </div>
            </div>
            <p style="font-size:11px;color:#6b7280;margin:0 0 8px;font-style:italic;">${phase.focus}</p>
            <ul style="margin:0;padding-left:16px;font-size:11px;color:#374151;line-height:1.6;">
              ${phase.tasks.map(task => `<li>${task}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('');
    }

    checkHealthcareRecommendation(analysis) {
      const container = document.getElementById('flashai-vto-healthcare-notice');
      const textEl = document.getElementById('flashai-vto-healthcare-text');
      if (!container || !analysis) return;

      // Conditions that warrant professional consultation
      const concerns = [];

      // Severe acne
      if ((analysis.acne_score || 0) > 70) {
        concerns.push('severe acne that may require prescription treatment');
      }

      // Rosacea indicators
      if (analysis.rosacea_indicators || (analysis.redness_score || 0) > 65) {
        concerns.push('persistent redness that could indicate rosacea');
      }

      // Severe pigmentation / melasma
      if (analysis.melasma_detected || (analysis.pigmentation_score || 0) > 70) {
        concerns.push('significant pigmentation that may need medical-grade treatments');
      }

      // Very low skin health score
      if ((analysis.skin_score || 50) < 30) {
        concerns.push('multiple skin concerns that could benefit from professional assessment');
      }

      // Severe dehydration with dry patches
      if (analysis.dry_patches_detected && (analysis.hydration_score || 65) < 30) {
        concerns.push('severe dehydration that may indicate a skin barrier condition');
      }

      // Deep wrinkles (possible sun damage)
      if ((analysis.deep_wrinkles_count || 0) > 5 || (analysis.sun_damage_score || 0) > 60) {
        concerns.push('signs of significant sun damage');
      }

      if (concerns.length > 0) {
        container.style.display = 'block';
        textEl.innerHTML = `
          Based on your scan, we detected <strong>${concerns.join(', ')}</strong>.
          While our product recommendations can help, we strongly recommend consulting a dermatologist
          or healthcare professional for personalized medical advice and potential prescription treatments.
          <br><br>
          <em style="font-size:11px;color:#991b1b;">This is not a medical diagnosis. Our AI analysis is for skincare guidance only.</em>
        `;
      } else {
        container.style.display = 'none';
      }
    }
  }

  // ==========================================================================
  // Auto-Initialization
  // ==========================================================================

  // Expose to window
  window.FlashAI_VTO_Widget = FlashAI_VTO_Widget;

  // Auto-initialize if config exists
  if (window.FLASHAI_VTO_CONFIG) {
    window.FlashAI_VTO = new FlashAI_VTO_Widget(window.FLASHAI_VTO_CONFIG);
  }
})();
// Build timestamp: Wed Jan 14 17:42:33 IST 2026
