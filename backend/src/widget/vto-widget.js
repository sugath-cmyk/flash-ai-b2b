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
        // NEW: Skin context for improved accuracy
        skinContext: {
          freckles: null, // none | some | many
          conditions: [], // rosacea, eczema, psoriasis, melasma
          skinType: null, // dry | oily | combination | normal
          sensitivity: null, // no | slightly | very
        },
        // NEW: Regional analysis grid (4x4 = 16 regions)
        regionalAnalysis: null,
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

          <!-- NEW: Skin Context Questionnaire (for better accuracy) -->
          <div id="flashai-vto-step-skin-context" class="flashai-vto-step" style="display:none;">
            <div class="flashai-vto-header">
              <h2>Quick Skin Profile</h2>
              <p>Help us analyze your skin more accurately (30 seconds)</p>
            </div>

            <div style="padding:0 20px;max-height:60vh;overflow-y:auto;">
              <!-- Question 1: Freckles -->
              <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                <h4 style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
                  <span>🌟</span> Do you have freckles?
                </h4>
                <div style="display:flex;gap:10px;">
                  <button class="flashai-context-btn" data-question="freckles" data-value="none" style="flex:1;padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">No freckles</button>
                  <button class="flashai-context-btn" data-question="freckles" data-value="some" style="flex:1;padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">Some freckles</button>
                  <button class="flashai-context-btn" data-question="freckles" data-value="many" style="flex:1;padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">Many freckles</button>
                </div>
              </div>

              <!-- Question 2: Known Conditions -->
              <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                <h4 style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
                  <span>💊</span> Any known skin conditions?
                </h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <button class="flashai-context-toggle" data-question="conditions" data-value="rosacea" style="padding:10px 16px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;">Rosacea</button>
                  <button class="flashai-context-toggle" data-question="conditions" data-value="eczema" style="padding:10px 16px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;">Eczema</button>
                  <button class="flashai-context-toggle" data-question="conditions" data-value="psoriasis" style="padding:10px 16px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;">Psoriasis</button>
                  <button class="flashai-context-toggle" data-question="conditions" data-value="melasma" style="padding:10px 16px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;">Melasma</button>
                  <button class="flashai-context-toggle" data-question="conditions" data-value="none" style="padding:10px 16px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;">None</button>
                </div>
              </div>

              <!-- Question 3: Skin Type -->
              <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                <h4 style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
                  <span>💧</span> How does your skin usually feel?
                </h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <button class="flashai-context-btn" data-question="skintype" data-value="dry" style="padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">
                    <span style="display:block;font-size:20px;margin-bottom:4px;">🏜️</span>Dry & Tight
                  </button>
                  <button class="flashai-context-btn" data-question="skintype" data-value="oily" style="padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">
                    <span style="display:block;font-size:20px;margin-bottom:4px;">✨</span>Oily & Shiny
                  </button>
                  <button class="flashai-context-btn" data-question="skintype" data-value="combination" style="padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">
                    <span style="display:block;font-size:20px;margin-bottom:4px;">⚖️</span>Combination
                  </button>
                  <button class="flashai-context-btn" data-question="skintype" data-value="normal" style="padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">
                    <span style="display:block;font-size:20px;margin-bottom:4px;">👍</span>Normal
                  </button>
                </div>
              </div>

              <!-- Question 4: Sensitivity -->
              <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                <h4 style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
                  <span>🌸</span> Is your skin sensitive?
                </h4>
                <div style="display:flex;gap:10px;">
                  <button class="flashai-context-btn" data-question="sensitivity" data-value="no" style="flex:1;padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">Not sensitive</button>
                  <button class="flashai-context-btn" data-question="sensitivity" data-value="slightly" style="flex:1;padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">Slightly</button>
                  <button class="flashai-context-btn" data-question="sensitivity" data-value="very" style="flex:1;padding:12px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">Very sensitive</button>
                </div>
              </div>

              <!-- Why we ask -->
              <div style="padding:12px 16px;background:linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%);border-radius:10px;margin-bottom:20px;">
                <p style="font-size:12px;color:#6b21a8;margin:0;display:flex;align-items:start;gap:8px;">
                  <span>💡</span>
                  <span>This helps us distinguish natural features (like freckles) from concerns, and provide more accurate analysis.</span>
                </p>
              </div>
            </div>

            <div style="padding:16px 20px;border-top:1px solid #e4e4e7;">
              <button id="flashai-vto-context-continue" style="width:100%;padding:16px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);transition:all 0.2s;">
                Continue to Scan →
              </button>
              <button id="flashai-vto-context-skip" style="width:100%;padding:12px;background:transparent;color:#71717a;border:none;font-size:13px;cursor:pointer;margin-top:8px;">
                Skip for now
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

              <!-- Floating Bottom Navigation -->
              <div class="flashai-vto-floating-nav" style="position:sticky;bottom:0;left:0;right:0;z-index:100;padding:12px 8px 16px;background:linear-gradient(180deg,transparent 0%,rgba(255,255,255,0.95) 20%,#fff 100%);margin:0 -20px -20px;pointer-events:none;">
                <div style="display:flex;justify-content:center;gap:6px;background:rgba(255,255,255,0.98);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:20px;padding:8px 12px;box-shadow:0 -4px 20px rgba(0,0,0,0.08),0 4px 20px rgba(0,0,0,0.12);border:1px solid rgba(139,92,246,0.15);pointer-events:auto;">
                  <button class="flashai-vto-tab active" data-tab="analysis" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);border:none;border-radius:14px;color:#fff;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.3s ease;min-width:56px;box-shadow:0 2px 8px rgba(139,92,246,0.4);">
                    <span style="font-size:18px;">📊</span>
                    <span>Analysis</span>
                  </button>
                  <button class="flashai-vto-tab" data-tab="goals" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;background:transparent;border:none;border-radius:14px;color:#71717a;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.3s ease;min-width:56px;">
                    <span style="font-size:18px;">🎯</span>
                    <span>Goals</span>
                  </button>
                  <button class="flashai-vto-tab" data-tab="routine" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;background:transparent;border:none;border-radius:14px;color:#71717a;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.3s ease;min-width:56px;">
                    <span style="font-size:18px;">✨</span>
                    <span>Routine</span>
                  </button>
                  <button class="flashai-vto-tab" data-tab="progress" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;background:transparent;border:none;border-radius:14px;color:#71717a;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.3s ease;min-width:56px;">
                    <span style="font-size:18px;">📈</span>
                    <span>Progress</span>
                  </button>
                  <button class="flashai-vto-tab" data-tab="predictions" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;background:transparent;border:none;border-radius:14px;color:#71717a;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.3s ease;min-width:56px;">
                    <span style="font-size:18px;">🔮</span>
                    <span>Predict</span>
                  </button>
                </div>
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
                <h3 class="flashai-vto-issues-title" style="font-size:14px;font-weight:700;color:#3f3f46;margin:0 0 8px;">Detected Concerns</h3>
                <p style="font-size:11px;color:#71717a;margin:0 0 12px;padding:8px 12px;background:#f9fafb;border-radius:8px;border-left:3px solid #8b5cf6;">
                  <strong>Note:</strong> AI analysis provides general guidance. Natural features like freckles may sometimes be detected. Results can vary based on lighting and image quality.
                </p>
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

              <!-- Tab Content: Goals (INTELLIGENT - Synced with Analysis) -->
              <div id="flashai-vto-tab-goals" class="flashai-vto-tab-content" style="display:none;">
                <div class="flashai-vto-goals-container" style="padding:0;">
                  <!-- No Analysis Prompt -->
                  <div id="flashai-vto-goals-no-analysis" style="display:none;text-align:center;padding:40px 20px;">
                    <div style="width:80px;height:80px;margin:0 auto 16px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                      <span style="font-size:36px;">📸</span>
                    </div>
                    <h3 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px;">Complete a Scan First</h3>
                    <p style="font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.5;">Your goals will be automatically created based on your skin analysis</p>
                    <button id="flashai-vto-goals-start-scan" style="padding:12px 32px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);">
                      Start Skin Analysis
                    </button>
                  </div>
                  <!-- Goals Content (Synced with Analysis) -->
                  <div id="flashai-vto-goals-content" style="display:none;">
                    <!-- Weekly Scan Reminder -->
                    <div id="flashai-vto-weekly-scan-reminder" style="margin-bottom:16px;padding:14px;background:linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%);border-radius:12px;border:1px solid #93c5fd;">
                      <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:44px;height:44px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                          <span style="font-size:22px;">📷</span>
                        </div>
                        <div style="flex:1;">
                          <h4 style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 2px;">Track Your Progress</h4>
                          <p style="font-size:11px;color:#1d4ed8;margin:0;">Take a scan every week to see real improvements</p>
                        </div>
                        <button id="flashai-vto-take-new-scan" style="padding:8px 14px;background:#1d4ed8;color:#fff;border:none;border-radius:16px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">
                          📸 New Scan
                        </button>
                      </div>
                    </div>
                    <!-- Synced Goals Header -->
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                      <h4 style="font-size:14px;font-weight:700;color:#18181b;margin:0;display:flex;align-items:center;gap:6px;">
                        🎯 Your Skin Goals
                        <span style="font-size:10px;font-weight:500;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:10px;">Synced</span>
                      </h4>
                      <span id="flashai-vto-last-scan-date" style="font-size:10px;color:#71717a;"></span>
                    </div>
                    <!-- Goals Cards (Auto-generated from Analysis) -->
                    <div id="flashai-vto-smart-goals" style="display:flex;flex-direction:column;gap:12px;">
                      <!-- Populated dynamically from analysis concerns -->
                    </div>
                    <!-- How It Works -->
                    <div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:10px;border:1px solid #e4e4e7;">
                      <h5 style="font-size:11px;font-weight:700;color:#71717a;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">How Goals Work</h5>
                      <div style="display:flex;flex-direction:column;gap:6px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="width:20px;height:20px;background:#8b5cf6;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">1</span>
                          <span style="font-size:11px;color:#52525b;">Goals auto-created from your analysis concerns</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="width:20px;height:20px;background:#8b5cf6;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">2</span>
                          <span style="font-size:11px;color:#52525b;">Tap any goal to adjust your target</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="width:20px;height:20px;background:#8b5cf6;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">3</span>
                          <span style="font-size:11px;color:#52525b;">Scan weekly to track your improvement</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div><!-- End Tab: Goals -->

              <!-- Tab Content: Routine (Phased System with Calendar) -->
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
                    <p style="font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.5;">Sign in to get a custom AM/PM skincare routine based on your goals</p>
                    <button id="flashai-vto-routine-signin" style="padding:12px 32px;background:linear-gradient(135deg,#db2777 0%,#be185d 100%);color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(219,39,119,0.3);transition:all 0.2s;">
                      Sign In for Routine
                    </button>
                  </div>

                  <!-- Skincare Experience Questionnaire -->
                  <div id="flashai-vto-routine-questionnaire" style="display:none;">
                    <div style="text-align:center;margin-bottom:20px;">
                      <h3 style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px;">Personalize Your Routine</h3>
                      <p style="font-size:13px;color:#71717a;margin:0;">Help us create the perfect routine for you (30 seconds)</p>
                    </div>

                    <!-- Age Range -->
                    <div style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:13px;font-weight:600;color:#18181b;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                        <span>🎂</span> What is your age range?
                      </h4>
                      <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        <button class="flashai-questionnaire-btn" data-question="ageRange" data-value="teens" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">Teens</button>
                        <button class="flashai-questionnaire-btn" data-question="ageRange" data-value="20s" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">20s</button>
                        <button class="flashai-questionnaire-btn" data-question="ageRange" data-value="30s" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">30s</button>
                        <button class="flashai-questionnaire-btn" data-question="ageRange" data-value="40s" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">40s</button>
                        <button class="flashai-questionnaire-btn" data-question="ageRange" data-value="50s" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">50s</button>
                        <button class="flashai-questionnaire-btn" data-question="ageRange" data-value="60+" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">60+</button>
                      </div>
                    </div>

                    <!-- Skincare Experience -->
                    <div style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:13px;font-weight:600;color:#18181b;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                        <span>💆</span> Current skincare routine?
                      </h4>
                      <div style="display:flex;flex-direction:column;gap:8px;">
                        <button class="flashai-questionnaire-btn" data-question="skincareExperience" data-value="none" style="padding:10px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;text-align:left;">🌱 No routine yet</button>
                        <button class="flashai-questionnaire-btn" data-question="skincareExperience" data-value="basic" style="padding:10px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;text-align:left;">🧴 Basic (cleanser + moisturizer)</button>
                        <button class="flashai-questionnaire-btn" data-question="skincareExperience" data-value="intermediate" style="padding:10px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;text-align:left;">✨ Intermediate (includes serums)</button>
                        <button class="flashai-questionnaire-btn" data-question="skincareExperience" data-value="advanced" style="padding:10px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;text-align:left;">🔬 Advanced (multiple actives, retinol)</button>
                      </div>
                    </div>

                    <!-- Used Actives -->
                    <div style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:13px;font-weight:600;color:#18181b;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                        <span>🧪</span> Active ingredients you have used? (select all)
                      </h4>
                      <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        <button class="flashai-questionnaire-toggle" data-question="usedActives" data-value="retinol" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">Retinol</button>
                        <button class="flashai-questionnaire-toggle" data-question="usedActives" data-value="vitamin_c" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">Vitamin C</button>
                        <button class="flashai-questionnaire-toggle" data-question="usedActives" data-value="acids" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">AHAs/BHAs</button>
                        <button class="flashai-questionnaire-toggle" data-question="usedActives" data-value="niacinamide" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">Niacinamide</button>
                        <button class="flashai-questionnaire-toggle" data-question="usedActives" data-value="none" style="padding:8px 14px;background:#fff;border:2px solid #e4e4e7;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;">None of these</button>
                      </div>
                    </div>

                    <!-- Skin Sensitivity -->
                    <div style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:13px;font-weight:600;color:#18181b;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                        <span>🌸</span> How sensitive is your skin?
                      </h4>
                      <div style="display:flex;gap:8px;">
                        <button class="flashai-questionnaire-btn" data-question="skinSensitivity" data-value="very_sensitive" style="flex:1;padding:10px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;">Very Sensitive</button>
                        <button class="flashai-questionnaire-btn" data-question="skinSensitivity" data-value="moderate" style="flex:1;padding:10px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;">Moderate</button>
                        <button class="flashai-questionnaire-btn" data-question="skinSensitivity" data-value="tolerant" style="flex:1;padding:10px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;">Tolerant</button>
                      </div>
                    </div>

                    <!-- Routine Consistency -->
                    <div style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e4e4e7;">
                      <h4 style="font-size:13px;font-weight:600;color:#18181b;margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                        <span>📅</span> How consistent are you with routines?
                      </h4>
                      <div style="display:flex;gap:8px;">
                        <button class="flashai-questionnaire-btn" data-question="routineConsistency" data-value="struggling" style="flex:1;padding:10px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;">Struggling</button>
                        <button class="flashai-questionnaire-btn" data-question="routineConsistency" data-value="sometimes" style="flex:1;padding:10px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;">Sometimes</button>
                        <button class="flashai-questionnaire-btn" data-question="routineConsistency" data-value="consistent" style="flex:1;padding:10px;background:#fff;border:2px solid #e4e4e7;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;">Consistent</button>
                      </div>
                    </div>

                    <!-- Why we ask -->
                    <div style="padding:12px;background:linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%);border-radius:10px;margin-bottom:16px;">
                      <p style="font-size:11px;color:#6b21a8;margin:0;display:flex;align-items:start;gap:6px;">
                        <span>💡</span>
                        <span>Based on dermatology research, we will start you at the right phase to build sustainable habits without overwhelming your skin.</span>
                      </p>
                    </div>

                    <button id="flashai-vto-questionnaire-submit" style="width:100%;padding:14px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);">
                      Start My Personalized Routine
                    </button>
                  </div>

                  <!-- Routine Content -->
                  <div id="flashai-vto-routine-content" style="display:none;">
                    <!-- Phase Banner -->
                    <div id="flashai-vto-phase-banner" style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%);border-radius:14px;border:1px solid #ddd6fe;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <div>
                          <div style="font-size:10px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px;">Phase <span id="flashai-phase-number">1</span> of 4</div>
                          <div style="font-size:16px;font-weight:700;color:#5b21b6;" id="flashai-phase-name">Foundation</div>
                        </div>
                        <div style="text-align:right;">
                          <div style="font-size:10px;color:#71717a;">Week</div>
                          <div style="font-size:18px;font-weight:700;color:#8b5cf6;" id="flashai-phase-week">1</div>
                        </div>
                      </div>
                      <div style="background:#e9d5ff;border-radius:6px;height:8px;overflow:hidden;margin-bottom:8px;">
                        <div id="flashai-phase-progress" style="height:100%;background:linear-gradient(90deg,#8b5cf6 0%,#7c3aed 100%);border-radius:6px;width:25%;transition:width 0.5s;"></div>
                      </div>
                      <p id="flashai-phase-description" style="font-size:11px;color:#6d28d9;margin:0;">Build healthy habits with core essentials</p>
                      <!-- Phase Tip -->
                      <div id="flashai-phase-tip" style="margin-top:10px;padding:10px 12px;background:rgba(255,255,255,0.7);border-radius:8px;display:flex;align-items:center;gap:8px;">
                        <span style="font-size:16px;">☀️</span>
                        <span style="font-size:11px;color:#5b21b6;" id="flashai-phase-tip-text">Apply sunscreen every morning, even on cloudy days</span>
                      </div>
                      <!-- Advance Phase Button (shown when ready) -->
                      <button id="flashai-vto-advance-phase" style="display:none;width:100%;margin-top:12px;padding:12px;background:#16a34a;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">
                        Ready for Phase 2? →
                      </button>
                    </div>

                    <!-- AM/PM Toggle -->
                    <div style="display:flex;gap:0;margin-bottom:16px;background:#f4f4f5;border-radius:25px;padding:4px;">
                      <button id="flashai-vto-routine-am" class="active" style="flex:1;padding:10px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:none;border-radius:22px;font-size:13px;font-weight:600;color:#92400e;cursor:pointer;transition:all 0.2s;">
                        ☀️ Morning
                      </button>
                      <button id="flashai-vto-routine-pm" style="flex:1;padding:10px;background:transparent;border:none;border-radius:22px;font-size:13px;font-weight:600;color:#71717a;cursor:pointer;transition:all 0.2s;">
                        🌙 Night
                      </button>
                    </div>
                    <!-- Routine Time Display -->
                    <div id="flashai-vto-routine-time-header" style="display:none;margin-bottom:12px;">
                      <!-- Total time shown here -->
                    </div>
                    <!-- Routine Steps -->
                    <div id="flashai-vto-routine-steps" style="display:flex;flex-direction:column;gap:10px;">
                      <!-- Populated dynamically -->
                    </div>
                    <!-- Complete Routine Button -->
                    <div id="flashai-vto-routine-actions" style="display:none;margin-top:16px;">
                      <!-- Complete button shown here -->
                    </div>
                    <!-- Generate Routine Button (when no routine exists) -->
                    <button id="flashai-vto-generate-routine" style="display:none;width:100%;margin-top:20px;padding:14px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);">
                      <span style="display:flex;align-items:center;justify-content:center;gap:8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
                        </svg>
                        Generate My Routine
                      </span>
                    </button>

                    <!-- Monthly Calendar -->
                    <div id="flashai-vto-routine-calendar" style="margin-top:20px;padding:16px;background:#fff;border-radius:14px;border:1px solid #e4e4e7;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <button id="flashai-cal-prev" style="width:32px;height:32px;background:#f4f4f5;border:none;border-radius:8px;cursor:pointer;font-size:14px;">◀</button>
                        <span id="flashai-cal-month" style="font-size:14px;font-weight:600;color:#18181b;">January 2026</span>
                        <button id="flashai-cal-next" style="width:32px;height:32px;background:#f4f4f5;border:none;border-radius:8px;cursor:pointer;font-size:14px;">▶</button>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:8px;">
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">S</span>
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">M</span>
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">T</span>
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">W</span>
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">T</span>
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">F</span>
                        <span style="text-align:center;font-size:10px;color:#71717a;font-weight:600;">S</span>
                      </div>
                      <div id="flashai-cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
                        <!-- Populated dynamically -->
                      </div>
                      <div style="display:flex;justify-content:center;gap:16px;margin-top:12px;padding-top:12px;border-top:1px solid #f4f4f5;">
                        <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:#71717a;">
                          <span style="width:8px;height:8px;background:#16a34a;border-radius:50%;"></span> Both
                        </span>
                        <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:#71717a;">
                          <span style="width:8px;height:8px;background:#f59e0b;border-radius:50%;"></span> One
                        </span>
                        <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:#71717a;">
                          <span style="width:8px;height:8px;background:#e4e4e7;border-radius:50%;"></span> Missed
                        </span>
                      </div>
                      <div id="flashai-cal-stats" style="display:flex;justify-content:space-around;margin-top:12px;padding:12px;background:#f9fafb;border-radius:10px;">
                        <div style="text-align:center;">
                          <div style="font-size:18px;font-weight:700;color:#8b5cf6;" id="flashai-cal-streak">0</div>
                          <div style="font-size:9px;color:#71717a;">Day Streak</div>
                        </div>
                        <div style="text-align:center;">
                          <div style="font-size:18px;font-weight:700;color:#16a34a;" id="flashai-cal-monthly">0%</div>
                          <div style="font-size:9px;color:#71717a;">This Month</div>
                        </div>
                      </div>
                    </div>

                    <!-- 12-Month Skincare Journey Timeline -->
                    <div class="flashai-vto-timeline" id="flashai-vto-timeline" style="margin-top:20px;padding:16px;background:linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%);border-radius:14px;border:1px solid #ddd6fe;">
                      <h3 style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#5b21b6;margin:0 0 12px;">
                        <span style="font-size:18px;">📅</span> Your 12-Month Skincare Journey
                      </h3>
                      <div id="flashai-vto-timeline-content" style="display:flex;flex-direction:column;gap:10px;">
                        <!-- Dynamically populated -->
                      </div>
                    </div>
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
        // Go to skin context questionnaire first for better accuracy
        this.showStep('skin-context');
      });

      // ========== NEW: Skin Context Questionnaire ==========
      // Single-select buttons (freckles, skintype, sensitivity)
      modal.querySelectorAll('.flashai-context-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const question = e.currentTarget.dataset.question;
          const value = e.currentTarget.dataset.value;

          // Update state
          this.state.skinContext[question] = value;

          // Update UI - highlight selected
          modal.querySelectorAll(`.flashai-context-btn[data-question="${question}"]`).forEach(b => {
            b.style.background = '#fff';
            b.style.borderColor = '#e4e4e7';
            b.style.color = '#3f3f46';
          });
          e.currentTarget.style.background = 'linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%)';
          e.currentTarget.style.borderColor = '#8b5cf6';
          e.currentTarget.style.color = '#6d28d9';
        });
      });

      // Multi-select toggles (conditions)
      modal.querySelectorAll('.flashai-context-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const value = e.currentTarget.dataset.value;
          const conditions = this.state.skinContext.conditions || [];

          if (value === 'none') {
            // Clear all conditions
            this.state.skinContext.conditions = [];
            modal.querySelectorAll('.flashai-context-toggle').forEach(b => {
              b.style.background = '#fff';
              b.style.borderColor = '#e4e4e7';
            });
            e.currentTarget.style.background = 'linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%)';
            e.currentTarget.style.borderColor = '#8b5cf6';
          } else {
            // Toggle this condition
            const idx = conditions.indexOf(value);
            if (idx > -1) {
              conditions.splice(idx, 1);
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#e4e4e7';
            } else {
              conditions.push(value);
              e.currentTarget.style.background = 'linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%)';
              e.currentTarget.style.borderColor = '#8b5cf6';
            }
            // Deselect "none" if something else selected
            if (conditions.length > 0) {
              const noneBtn = modal.querySelector('.flashai-context-toggle[data-value="none"]');
              if (noneBtn) {
                noneBtn.style.background = '#fff';
                noneBtn.style.borderColor = '#e4e4e7';
              }
            }
            this.state.skinContext.conditions = conditions;
          }
        });
      });

      // Continue to scan
      modal.querySelector('#flashai-vto-context-continue')?.addEventListener('click', () => {
        console.log('Skin context collected:', this.state.skinContext);
        this.showStep('facescan');
      });

      // Skip questionnaire
      modal.querySelector('#flashai-vto-context-skip')?.addEventListener('click', () => {
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

      // ========== NEW: Routine Events ==========
      modal.querySelector('#flashai-vto-routine-signin')?.addEventListener('click', () => {
        this.showAuthModal();
      });

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

      modal.querySelector('#flashai-vto-auto-goals-btn')?.addEventListener('click', () => {
        this.autoSetGoalsFromScan();
      });

      // ========== NEW: Prediction Timeframe ==========
      modal.querySelectorAll('.flashai-vto-timeframe').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const weeks = parseInt(e.currentTarget.dataset.weeks);
          this.loadPredictions(weeks);
        });
      });

      // ========== NEW: Phased Routine Questionnaire & Calendar ==========
      this.initQuestionnaireEvents();
    }

    // ==========================================================================
    // NEW: Tab Management
    // ==========================================================================

    switchTab(tabName) {
      const modal = this.elements.modal;

      // Update tab buttons (floating nav style)
      modal.querySelectorAll('.flashai-vto-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
          tab.classList.add('active');
          tab.style.background = 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)';
          tab.style.color = '#fff';
          tab.style.boxShadow = '0 2px 8px rgba(139,92,246,0.4)';
        } else {
          tab.classList.remove('active');
          tab.style.background = 'transparent';
          tab.style.color = '#71717a';
          tab.style.boxShadow = 'none';
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

    /**
     * Migrate to phased routine system - clears old cached data
     * Version 2: Phased routine system with questionnaire
     */
    migrateToPhaseSystem() {
      const CURRENT_VERSION = 2;
      const storedVersion = parseInt(localStorage.getItem('flashai_routine_version') || '0');

      if (storedVersion < CURRENT_VERSION) {
        console.log('[Migration] Upgrading to phased routine system v' + CURRENT_VERSION);

        // Clear old routine-related cached data
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('routine') ||
            key.includes('flashai_goals') ||
            key.includes('flashai_phase')
          )) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => {
          console.log('[Migration] Removing cached:', key);
          localStorage.removeItem(key);
        });

        // Clear state
        this.state.routines = null;
        this.state.currentPhase = null;
        this.state.questionnaireAnswers = null;

        // Set new version
        localStorage.setItem('flashai_routine_version', CURRENT_VERSION.toString());
        console.log('[Migration] Migration complete. Users will see questionnaire.');
      }
    }

    checkStoredAuth() {
      // First, migrate to new phased system (clears old cached routines)
      this.migrateToPhaseSystem();

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
    // INTELLIGENT GOALS - Synced with Analysis
    // ==========================================================================

    async loadGoalsData() {
      const noAnalysisPrompt = document.getElementById('flashai-vto-goals-no-analysis');
      const goalsContent = document.getElementById('flashai-vto-goals-content');
      const smartGoalsContainer = document.getElementById('flashai-vto-smart-goals');
      const lastScanDate = document.getElementById('flashai-vto-last-scan-date');

      // Check if we have analysis data
      const issues = this.state.detectedIssues || [];
      const analysis = this.state.currentAnalysis;

      if (!analysis || issues.length === 0) {
        // No analysis yet - show prompt to scan
        if (noAnalysisPrompt) noAnalysisPrompt.style.display = 'block';
        if (goalsContent) goalsContent.style.display = 'none';

        // Add event handler for start scan button
        const startScanBtn = document.getElementById('flashai-vto-goals-start-scan');
        if (startScanBtn) {
          startScanBtn.onclick = () => this.showStep('facescan');
        }
        return;
      }

      // We have analysis - show goals
      if (noAnalysisPrompt) noAnalysisPrompt.style.display = 'none';
      if (goalsContent) goalsContent.style.display = 'block';

      // Update last scan date
      if (lastScanDate) {
        lastScanDate.textContent = 'Last scan: Today';
      }

      // Render smart goals from analysis
      this.renderSmartGoals(issues, smartGoalsContainer);

      // Add event handler for new scan button
      const newScanBtn = document.getElementById('flashai-vto-take-new-scan');
      if (newScanBtn) {
        newScanBtn.onclick = () => this.showStep('facescan');
      }
    }

    /**
     * Render goals directly from analysis concerns (read-only display)
     */
    renderSmartGoals(issues, container) {
      if (!container) return;

      // Separate concerns from healthy metrics
      const concerns = issues.filter(i => i.isConcern);
      const healthy = issues.filter(i => !i.isConcern);

      let html = '';

      // Priority concerns as goals
      if (concerns.length > 0) {
        html += '<div style="margin-bottom:10px;"><span style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">🎯 Focus Areas (' + concerns.length + ')</span></div>';

        concerns.forEach((issue, idx) => {
          const grade = issue.clinicalGrade || { grade: 0, label: 'N/A', scale: 'General', maxGrade: 4 };

          // Severity color
          const severityColor = grade.grade >= 3 ? '#dc2626' : grade.grade >= 2 ? '#f59e0b' : '#16a34a';
          const bgColor = grade.grade >= 3 ? '#fef2f2' : grade.grade >= 2 ? '#fffbeb' : '#f0fdf4';
          const borderColor = grade.grade >= 3 ? '#fecaca' : grade.grade >= 2 ? '#fde68a' : '#bbf7d0';

          // Get recommendation based on concern
          const recommendation = this.getGoalRecommendation(issue.key);

          html += '<div style="padding:12px;background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:12px;margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:18px;">' + (issue.icon || '🎯') + '</span>' +
                '<div>' +
                  '<h5 style="font-size:12px;font-weight:700;color:#18181b;margin:0;">' + issue.name + '</h5>' +
                  '<p style="font-size:9px;color:#71717a;margin:2px 0 0;">' + grade.scale + ' • ' + issue.region + '</p>' +
                '</div>' +
              '</div>' +
              '<span style="padding:3px 8px;background:' + severityColor + ';color:#fff;font-size:9px;font-weight:700;border-radius:10px;">Grade ' + grade.grade + '</span>' +
            '</div>' +
            // Grade bar visualization
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
              '<div style="flex:1;background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">' +
                '<div style="width:' + ((grade.grade / grade.maxGrade) * 100) + '%;height:100%;background:' + severityColor + ';border-radius:4px;"></div>' +
              '</div>' +
              '<span style="font-size:10px;color:#71717a;white-space:nowrap;">' + grade.grade + '/' + grade.maxGrade + '</span>' +
            '</div>' +
            // Recommendation
            '<div style="padding:8px 10px;background:rgba(255,255,255,0.7);border-radius:8px;">' +
              '<p style="font-size:10px;color:#52525b;margin:0;line-height:1.4;">' +
                '<span style="font-weight:600;">Recommendation:</span> ' + recommendation +
              '</p>' +
            '</div>' +
          '</div>';
        });
      }

      // Healthy metrics (maintain)
      if (healthy.length > 0) {
        html += '<div style="margin:16px 0 8px;"><span style="font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">✅ Healthy (' + healthy.length + ')</span></div>';

        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">';
        healthy.forEach(issue => {
          const grade = issue.clinicalGrade || { grade: 0, label: 'Good', maxGrade: 4 };
          html += '<div style="padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">' +
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
              '<span style="font-size:14px;">' + (issue.icon || '✓') + '</span>' +
              '<span style="font-size:11px;font-weight:600;color:#166534;">' + issue.name + '</span>' +
            '</div>' +
            '<div style="font-size:10px;color:#15803d;">' + grade.label + '</div>' +
          '</div>';
        });
        html += '</div>';
      }

      container.innerHTML = html;
    }

    /**
     * Get recommendation text for a specific concern
     */
    getGoalRecommendation(key) {
      const recommendations = {
        acne: 'Use salicylic acid cleanser, niacinamide serum. Avoid touching face.',
        dark_circles: 'Get 7-8 hours sleep, use caffeine eye cream, stay hydrated.',
        wrinkles: 'Apply retinol at night, use SPF 50 daily, add vitamin C serum.',
        redness: 'Use gentle, fragrance-free products. Try centella/cica ingredients.',
        pigmentation: 'Vitamin C in AM, exfoliate 2x/week, never skip sunscreen.',
        hydration: 'Layer hydrating products, use hyaluronic acid, drink more water.',
        oiliness: 'Use niacinamide, lightweight moisturizer, don\'t over-cleanse.',
        pores: 'BHA exfoliant 2-3x/week, niacinamide serum, clay mask weekly.',
        texture: 'AHA/BHA exfoliants, retinol at night, gentle physical exfoliation.'
      };
      return recommendations[key] || 'Follow your personalized routine consistently.';
    }

    // Legacy method - kept for backwards compatibility
    renderGoals(goals, container) {
      // Now redirects to smart goals
      this.loadGoalsData();
    }

    /**
     * Show monthly progress modal for a specific goal
     */
    async showMonthlyProgress(goalId) {
      if (!this.state.authToken) return;

      try {
        const response = await fetch(`${this.config.apiBaseUrl.replace('/api/vto', '/api/widget/goals')}/${goalId}/monthly`, {
          headers: {
            'Authorization': `Bearer ${this.state.authToken}`,
            'X-API-Key': this.config.apiKey
          }
        });

        const data = await response.json();

        if (data.success) {
          this.renderMonthlyProgressModal(data.data.monthlyProgress, goalId);
        } else {
          console.error('Error fetching monthly progress:', data.message);
        }
      } catch (error) {
        console.error('Error loading monthly progress:', error);
      }
    }

    renderMonthlyProgressModal(progress, goalId) {
      // Remove existing modal if any
      const existingModal = document.getElementById('flashai-monthly-progress-modal');
      if (existingModal) existingModal.remove();

      const months = progress || [];

      const modal = document.createElement('div');
      modal.id = 'flashai-monthly-progress-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100001;';

      modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;max-width:400px;width:90%;max-height:80vh;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.3);">
          <div style="padding:20px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3 style="margin:0;font-size:18px;font-weight:700;">📊 Monthly Progress</h3>
              <button id="flashai-close-monthly-modal" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;">&times;</button>
            </div>
          </div>
          <div style="padding:20px;overflow-y:auto;max-height:60vh;">
            ${months.length === 0 ? `
              <div style="text-align:center;padding:30px;color:#71717a;">
                <div style="font-size:40px;margin-bottom:12px;">📅</div>
                <p style="font-size:14px;">No monthly data yet.</p>
                <p style="font-size:12px;">Keep scanning to track your progress over time!</p>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:12px;">
                ${months.map((m, i) => {
                  const change = m.change || 0;
                  const changeColor = change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#71717a';
                  const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '→';
                  const isLatest = i === 0;

                  return `
                    <div style="padding:16px;background:${isLatest ? 'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)' : '#f9fafb'};border:1px solid ${isLatest ? '#e9d5ff' : '#e4e4e7'};border-radius:12px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:14px;font-weight:600;color:#18181b;">${m.month || 'Month ' + (months.length - i)}</span>
                        ${isLatest ? '<span style="padding:2px 8px;background:#8b5cf6;color:#fff;font-size:10px;border-radius:10px;">Current</span>' : ''}
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                          <span style="font-size:24px;font-weight:700;color:#8b5cf6;">${m.value || 0}</span>
                          <span style="font-size:12px;color:#71717a;margin-left:4px;">score</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:4px;color:${changeColor};font-weight:600;font-size:13px;">
                          <span>${changeIcon}</span>
                          <span>${Math.abs(change)}</span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close handlers
      modal.querySelector('#flashai-close-monthly-modal').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    }

    renderGoalTemplates(templates, container) {
      if (!container || !templates) return;

      // Deduplicate by name
      const uniqueTemplates = [];
      const seen = new Set();
      for (const t of templates) {
        if (!seen.has(t.name)) {
          seen.add(t.name);
          uniqueTemplates.push(t);
        }
      }

      const icons = {
        'Clear Acne': '✨', 'Reduce Wrinkles': '🕐', 'Hydrate Skin': '💧',
        'Even Skin Tone': '☀️', 'Smooth Texture': '🪶', 'Reduce Redness': '❤️', 'Control Oil': '🛡️'
      };

      container.innerHTML = uniqueTemplates.map(t => `
        <button class="flashai-goal-template" data-template-id="${t.id}" style="padding:12px;background:#fff;border:1px solid #e4e4e7;border-radius:10px;text-align:left;cursor:pointer;transition:all 0.2s;">
          <div style="font-size:16px;margin-bottom:4px;">${icons[t.name] || '🎯'}</div>
          <div style="font-size:12px;font-weight:600;color:#18181b;margin-bottom:2px;">${t.name}</div>
          <div style="font-size:10px;color:#71717a;">${t.typicalDurationWeeks || 8} weeks</div>
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

    // Legacy functions - no longer used, goals auto-populate from analysis
    showAddGoalModal() {
      // Goals are now auto-generated from analysis
      this.loadGoalsData();
    }

    autoSetGoalsFromScan() {
      // Goals are now auto-generated from analysis - just refresh
      this.loadGoalsData();
    }

    // ==========================================================================
    // ROUTINE - Goal-based from Backend API
    // ==========================================================================

    async loadRoutineData() {
      console.log('[Routine] loadRoutineData called');
      const loginPrompt = document.getElementById('flashai-vto-routine-login-prompt');
      const routineContent = document.getElementById('flashai-vto-routine-content');
      const questionnaire = document.getElementById('flashai-vto-routine-questionnaire');
      const generateBtn = document.getElementById('flashai-vto-generate-routine');
      console.log('[Routine] Elements found: loginPrompt=' + !!loginPrompt + ', routineContent=' + !!routineContent + ', questionnaire=' + !!questionnaire);

      // Check if authenticated
      if (!this.state.authToken) {
        console.log('[Routine] Not authenticated, showing login prompt');
        if (loginPrompt) loginPrompt.style.display = 'block';
        if (routineContent) routineContent.style.display = 'none';
        if (questionnaire) questionnaire.style.display = 'none';
        return;
      }

      console.log('[Routine] User is authenticated');
      if (loginPrompt) loginPrompt.style.display = 'none';

      try {
        // Load phase info and routines in parallel
        const routinesUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines');
        console.log('[Routine] Fetching routines and phase data...');

        const [phaseData, stats, routinesResponse] = await Promise.all([
          this.loadPhaseData(),
          this.loadRoutineStats(),
          fetch(routinesUrl, {
            headers: { 'Authorization': 'Bearer ' + this.state.authToken }
          })
        ]);

        const routinesData = await routinesResponse.json();
        console.log('[Routine] Phase data:', phaseData);
        console.log('[Routine] Routines API response:', routinesData);

        // Check if user needs to complete questionnaire (no phase initialized)
        const hasPhase = phaseData && phaseData.phase && phaseData.phase.phaseNumber;
        const hasRoutines = routinesData.success && routinesData.data && routinesData.data.routines && routinesData.data.routines.length > 0;

        if (!hasPhase && !hasRoutines) {
          // Show questionnaire for new users
          console.log('[Routine] No phase found, showing questionnaire');
          if (questionnaire) questionnaire.style.display = 'block';
          if (routineContent) routineContent.style.display = 'none';
          return;
        }

        // User has phase - show routine content
        if (questionnaire) questionnaire.style.display = 'none';
        if (routineContent) routineContent.style.display = 'block';

        // Render phase banner if we have phase data
        if (phaseData && phaseData.phase) {
          this.state.currentPhase = phaseData.phase;
          this.renderPhaseBanner(phaseData);
          this.renderMilestoneTimeline(phaseData.phase.phaseNumber);
        }

        // Render stats header
        this.renderRoutineStats(stats);

        // Load and render calendar
        this.loadCalendarData();

        if (hasRoutines) {
          console.log('[Routine] Found ' + routinesData.data.routines.length + ' routines, rendering...');
          this.state.routines = routinesData.data.routines;
          if (generateBtn) generateBtn.style.display = 'none';
          this.state.currentRoutineTime = 'am';
          this.renderRoutine('am');
        } else {
          console.log('[Routine] No routines found, showing generate button');
          if (generateBtn) generateBtn.style.display = 'block';
          this.renderEmptyRoutine();
        }
      } catch (error) {
        console.error('[Routine] Error loading routines:', error);
        if (generateBtn) generateBtn.style.display = 'block';
        this.renderEmptyRoutine();
      }
    }

    async loadRoutineStats() {
      if (!this.state.authToken) return null;

      try {
        const statsUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/stats';
        const response = await fetch(statsUrl, {
          headers: { 'Authorization': 'Bearer ' + this.state.authToken }
        });
        const data = await response.json();
        return data.success ? data.data : null;
      } catch (error) {
        console.error('[Routine] Error loading stats:', error);
        return null;
      }
    }

    renderRoutineStats(stats) {
      const container = document.getElementById('flashai-vto-routine-stats');
      if (!container) return;

      if (!stats || (stats.currentStreak === 0 && stats.completionsThisWeek === 0)) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">' +
        '<div style="text-align:center;padding:12px 8px;background:#fef3c7;border-radius:10px;">' +
          '<div style="font-size:18px;font-weight:700;color:#92400e;">' + stats.currentStreak + '</div>' +
          '<div style="font-size:9px;color:#a16207;">Day Streak</div>' +
        '</div>' +
        '<div style="text-align:center;padding:12px 8px;background:#e0e7ff;border-radius:10px;">' +
          '<div style="font-size:18px;font-weight:700;color:#4338ca;">' + stats.completionsThisWeek + '</div>' +
          '<div style="font-size:9px;color:#6366f1;">This Week</div>' +
        '</div>' +
        '<div style="text-align:center;padding:12px 8px;background:#f0fdf4;border-radius:10px;">' +
          '<div style="font-size:18px;font-weight:700;color:#16a34a;">' + stats.averageCompletion + '%</div>' +
          '<div style="font-size:9px;color:#22c55e;">Avg Complete</div>' +
        '</div>' +
      '</div>';
    }

    switchRoutineTime(time) {
      const amBtn = document.getElementById('flashai-vto-routine-am');
      const pmBtn = document.getElementById('flashai-vto-routine-pm');

      if (time === 'am') {
        if (amBtn) {
          amBtn.style.background = 'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)';
          amBtn.style.color = '#92400e';
        }
        if (pmBtn) {
          pmBtn.style.background = 'transparent';
          pmBtn.style.color = '#71717a';
        }
      } else {
        if (pmBtn) {
          pmBtn.style.background = 'linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%)';
          pmBtn.style.color = '#4338ca';
        }
        if (amBtn) {
          amBtn.style.background = 'transparent';
          amBtn.style.color = '#71717a';
        }
      }

      this.state.currentRoutineTime = time;
      this.renderRoutine(time);
    }

    /**
     * Generate intelligent routine based on detected skin concerns
     */
    generateSmartRoutine(time) {
      const issues = this.state.detectedIssues || [];
      const concerns = issues.filter(i => i.isConcern).map(i => i.key);

      // Ingredient database based on concerns
      const ingredientsByConern = {
        acne: { primary: 'Salicylic Acid (BHA)', secondary: 'Niacinamide', avoid: 'Heavy oils' },
        dark_circles: { primary: 'Caffeine', secondary: 'Vitamin K, Peptides', avoid: 'Harsh rubbing' },
        wrinkles: { primary: 'Retinol', secondary: 'Peptides, Vitamin C', avoid: 'Sun without SPF' },
        redness: { primary: 'Centella Asiatica', secondary: 'Niacinamide, Azelaic Acid', avoid: 'Fragrance, Alcohol' },
        pigmentation: { primary: 'Vitamin C', secondary: 'Alpha Arbutin, Tranexamic Acid', avoid: 'Sun exposure' },
        hydration: { primary: 'Hyaluronic Acid', secondary: 'Ceramides, Glycerin', avoid: 'Alcohol-based products' },
        oiliness: { primary: 'Niacinamide', secondary: 'BHA, Zinc', avoid: 'Heavy creams' },
        pores: { primary: 'Niacinamide', secondary: 'BHA, Retinol', avoid: 'Pore-clogging ingredients' },
        texture: { primary: 'AHA (Glycolic/Lactic)', secondary: 'Retinol, Vitamin C', avoid: 'Over-exfoliation' }
      };

      // Get primary ingredients for this user's concerns
      const primaryIngredients = concerns.map(c => ingredientsByConern[c]?.primary).filter(Boolean);
      const secondaryIngredients = concerns.map(c => ingredientsByConern[c]?.secondary).filter(Boolean);

      let steps = [];

      if (time === 'am') {
        // ============ MORNING ROUTINE ============
        steps = [
          {
            step: 1,
            name: 'Gentle Cleanser',
            icon: '🧼',
            why: 'Remove overnight oil and prep skin',
            ingredients: concerns.includes('acne') ? 'Salicylic acid or gentle foaming cleanser' :
                        concerns.includes('redness') ? 'Gentle, fragrance-free cleanser' :
                        'Gentle cream or gel cleanser',
            tip: 'Use lukewarm water, not hot',
            bgColor: '#fef3c7',
            borderColor: '#fde68a'
          },
          {
            step: 2,
            name: 'Toner (Optional)',
            icon: '💧',
            why: 'Balance pH and add hydration',
            ingredients: concerns.includes('pores') ? 'Niacinamide toner' :
                        concerns.includes('hydration') ? 'Hydrating essence with Hyaluronic Acid' :
                        'Alcohol-free balancing toner',
            tip: 'Pat gently, don\'t rub',
            bgColor: '#e0f2fe',
            borderColor: '#bae6fd',
            optional: true
          },
          {
            step: 3,
            name: 'Treatment Serum',
            icon: '✨',
            why: this.getSerumReason(concerns, 'am'),
            ingredients: concerns.includes('pigmentation') || concerns.includes('wrinkles') ? 'Vitamin C (10-20%)' :
                        concerns.includes('acne') ? 'Niacinamide 10%' :
                        concerns.includes('redness') ? 'Centella/Cica serum' :
                        'Antioxidant serum',
            tip: 'Apply to slightly damp skin',
            bgColor: '#fce7f3',
            borderColor: '#fbcfe8',
            highlighted: true
          }
        ];

        // Add eye cream if dark circles detected
        if (concerns.includes('dark_circles')) {
          steps.push({
            step: steps.length + 1,
            name: 'Eye Cream',
            icon: '👁️',
            why: 'Target dark circles and puffiness',
            ingredients: 'Caffeine, Vitamin K, Peptides',
            tip: 'Use ring finger, pat gently around orbital bone',
            bgColor: '#f3e8ff',
            borderColor: '#e9d5ff'
          });
        }

        steps.push({
          step: steps.length + 1,
          name: 'Moisturizer',
          icon: '🧴',
          why: 'Lock in hydration and protect barrier',
          ingredients: concerns.includes('oiliness') ? 'Lightweight, oil-free gel moisturizer' :
                      concerns.includes('hydration') ? 'Rich cream with Ceramides' :
                      concerns.includes('acne') ? 'Non-comedogenic moisturizer' :
                      'Balanced moisturizer for your skin type',
          tip: 'Wait 1-2 minutes before sunscreen',
          bgColor: '#dcfce7',
          borderColor: '#bbf7d0'
        });

        // Sunscreen is ALWAYS last and most important
        steps.push({
          step: steps.length + 1,
          name: 'Sunscreen SPF 30+',
          icon: '☀️',
          why: 'ESSENTIAL: Prevents aging, pigmentation, and skin damage',
          ingredients: concerns.includes('acne') ? 'Lightweight, non-comedogenic SPF 50' :
                      concerns.includes('redness') ? 'Mineral sunscreen (Zinc Oxide)' :
                      'Broad-spectrum SPF 30-50',
          tip: 'Apply generously, reapply every 2 hours outdoors',
          bgColor: '#fef9c3',
          borderColor: '#fef08a',
          critical: true
        });

      } else {
        // ============ NIGHT ROUTINE ============
        steps = [
          {
            step: 1,
            name: 'Oil Cleanser / Makeup Remover',
            icon: '🫧',
            why: 'Remove sunscreen, makeup, and sebum',
            ingredients: 'Cleansing oil or micellar water',
            tip: 'Massage for 60 seconds to dissolve impurities',
            bgColor: '#e0e7ff',
            borderColor: '#c7d2fe'
          },
          {
            step: 2,
            name: 'Water-Based Cleanser',
            icon: '🧼',
            why: 'Deep clean pores after oil cleanse',
            ingredients: concerns.includes('acne') ? 'Salicylic acid cleanser' :
                        concerns.includes('redness') ? 'Gentle, soothing cleanser' :
                        'pH-balanced cleanser',
            tip: 'Don\'t over-cleanse, 30-60 seconds is enough',
            bgColor: '#fef3c7',
            borderColor: '#fde68a'
          }
        ];

        // Add exfoliant for specific concerns (2-3x per week)
        if (concerns.includes('texture') || concerns.includes('acne') || concerns.includes('pigmentation') || concerns.includes('pores')) {
          steps.push({
            step: steps.length + 1,
            name: 'Exfoliant (2-3x/week)',
            icon: '🔄',
            why: concerns.includes('texture') ? 'Smooth rough texture and promote cell turnover' :
                concerns.includes('acne') ? 'Unclog pores and prevent breakouts' :
                concerns.includes('pigmentation') ? 'Fade dark spots faster' :
                'Minimize pores and improve clarity',
            ingredients: concerns.includes('acne') ? 'BHA (Salicylic Acid 2%)' :
                        concerns.includes('pigmentation') ? 'AHA (Glycolic Acid 5-10%)' :
                        'AHA/BHA blend or gentle enzyme exfoliant',
            tip: 'Start 1x/week, never use with retinol on same night',
            bgColor: '#fce7f3',
            borderColor: '#fbcfe8',
            frequency: '2-3x/week'
          });
        }

        steps.push({
          step: steps.length + 1,
          name: 'Toner/Essence',
          icon: '💧',
          why: 'Prep skin for better absorption of treatments',
          ingredients: concerns.includes('hydration') ? 'Hydrating essence with Hyaluronic Acid' :
                      concerns.includes('redness') ? 'Calming toner with Centella' :
                      'Hydrating, alcohol-free toner',
          tip: 'Apply while skin is still slightly damp',
          bgColor: '#e0f2fe',
          borderColor: '#bae6fd'
        });

        // Main treatment serum (the hero product)
        steps.push({
          step: steps.length + 1,
          name: 'Treatment Serum',
          icon: '⭐',
          why: this.getSerumReason(concerns, 'pm'),
          ingredients: concerns.includes('wrinkles') || concerns.includes('texture') ? 'Retinol (start 0.25%, work up)' :
                      concerns.includes('acne') ? 'Niacinamide 10% + Zinc' :
                      concerns.includes('pigmentation') ? 'Alpha Arbutin + Tranexamic Acid' :
                      concerns.includes('redness') ? 'Azelaic Acid 10%' :
                      'Peptide serum for repair',
          tip: concerns.includes('wrinkles') ? 'Start 2x/week, increase gradually' : 'Apply to problem areas',
          bgColor: '#fef3c7',
          borderColor: '#fde68a',
          highlighted: true
        });

        // Add eye cream if dark circles
        if (concerns.includes('dark_circles')) {
          steps.push({
            step: steps.length + 1,
            name: 'Eye Cream',
            icon: '👁️',
            why: 'Repair and brighten overnight',
            ingredients: 'Retinol eye cream or Peptides',
            tip: 'Apply before moisturizer, use sparingly',
            bgColor: '#f3e8ff',
            borderColor: '#e9d5ff'
          });
        }

        steps.push({
          step: steps.length + 1,
          name: 'Night Moisturizer',
          icon: '🌙',
          why: 'Support overnight skin repair',
          ingredients: concerns.includes('hydration') ? 'Rich night cream with Ceramides & Squalane' :
                      concerns.includes('oiliness') ? 'Lightweight gel-cream' :
                      concerns.includes('acne') ? 'Non-comedogenic night moisturizer' :
                      'Nourishing night cream',
          tip: 'Can be richer than AM moisturizer',
          bgColor: '#e0e7ff',
          borderColor: '#c7d2fe'
        });
      }

      return steps;
    }

    getSerumReason(concerns, time) {
      if (time === 'am') {
        if (concerns.includes('pigmentation')) return 'Brighten skin and protect against free radicals';
        if (concerns.includes('wrinkles')) return 'Antioxidant protection against daily damage';
        if (concerns.includes('acne')) return 'Control oil and minimize breakouts';
        if (concerns.includes('redness')) return 'Calm inflammation and strengthen skin barrier';
        return 'Protect and nourish your skin';
      } else {
        if (concerns.includes('wrinkles')) return 'Stimulate collagen and reduce fine lines';
        if (concerns.includes('acne')) return 'Control bacteria and regulate sebum overnight';
        if (concerns.includes('pigmentation')) return 'Fade dark spots while you sleep';
        if (concerns.includes('redness')) return 'Calm and repair irritated skin overnight';
        return 'Repair and rejuvenate while you sleep';
      }
    }

    renderSmartRoutine(time) {
      const container = document.getElementById('flashai-vto-routine-steps');
      const tipsContainer = document.getElementById('flashai-vto-routine-tips');
      if (!container) return;

      const steps = this.generateSmartRoutine(time);
      const issues = this.state.detectedIssues || [];
      const concerns = issues.filter(i => i.isConcern);

      let html = '';
      steps.forEach((step, idx) => {
        const highlightStyle = step.highlighted ? 'border-width:2px;' : '';
        const criticalBadge = step.critical ? '<span style="margin-left:6px;padding:2px 6px;background:#dc2626;color:#fff;font-size:8px;font-weight:700;border-radius:8px;">MUST HAVE</span>' : '';
        const optionalBadge = step.optional ? '<span style="margin-left:6px;padding:2px 6px;background:#71717a;color:#fff;font-size:8px;font-weight:600;border-radius:8px;">OPTIONAL</span>' : '';
        const freqBadge = step.frequency ? '<span style="margin-left:6px;padding:2px 6px;background:#8b5cf6;color:#fff;font-size:8px;font-weight:600;border-radius:8px;">' + step.frequency + '</span>' : '';

        html += '<div style="display:flex;gap:12px;padding:12px;background:#fff;border:1px solid ' + step.borderColor + ';border-radius:12px;' + highlightStyle + '">' +
          '<div style="width:36px;height:36px;background:' + step.bgColor + ';border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<span style="font-size:16px;">' + step.icon + '</span>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:4px;">' +
              '<span style="font-size:12px;font-weight:700;color:#18181b;">' + step.name + '</span>' +
              criticalBadge + optionalBadge + freqBadge +
            '</div>' +
            '<p style="font-size:10px;color:#52525b;margin:0 0 6px;line-height:1.4;">' + step.why + '</p>' +
            '<div style="padding:6px 8px;background:#f9fafb;border-radius:6px;margin-bottom:4px;">' +
              '<span style="font-size:9px;color:#71717a;">Look for: </span>' +
              '<span style="font-size:9px;font-weight:600;color:#18181b;">' + step.ingredients + '</span>' +
            '</div>' +
            '<p style="font-size:9px;color:#8b5cf6;margin:0;font-style:italic;">💡 ' + step.tip + '</p>' +
          '</div>' +
        '</div>';
      });

      container.innerHTML = html;

      // Render tips section
      if (tipsContainer) {
        const topConcerns = concerns.slice(0, 2).map(c => c.name).join(' & ');
        tipsContainer.innerHTML = '<h5 style="font-size:11px;font-weight:700;color:#71717a;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">' + (time === 'am' ? '☀️ Morning' : '🌙 Night') + ' Tips</h5>' +
          '<div style="display:flex;flex-direction:column;gap:4px;">' +
            '<p style="font-size:10px;color:#52525b;margin:0;">• ' + (time === 'am' ? 'Wait 2-3 mins between layers for absorption' : 'Apply products in order of thinnest to thickest') + '</p>' +
            '<p style="font-size:10px;color:#52525b;margin:0;">• ' + (time === 'am' ? 'Never skip sunscreen - even on cloudy days!' : 'Night is the best time for active treatments') + '</p>' +
            (topConcerns ? '<p style="font-size:10px;color:#52525b;margin:0;">• Targeting: <strong>' + topConcerns + '</strong></p>' : '') +
          '</div>';
      }
    }

    // Render routine from backend data (goal-based) - filtered by current phase
    renderRoutine(time) {
      const container = document.getElementById('flashai-vto-routine-steps');
      const timeHeader = document.getElementById('flashai-vto-routine-time-header');
      const actionsContainer = document.getElementById('flashai-vto-routine-actions');
      if (!container) return;

      // Find routine for this time (using camelCase from backend)
      const routine = this.state.routines?.find(r => r.routineType === time);

      if (!routine || !routine.steps || routine.steps.length === 0) {
        this.renderEmptyRoutine();
        return;
      }

      // Get current phase (default to 1 if not set)
      const currentPhase = this.state.currentPhase?.phaseNumber || 1;

      // Define allowed step types per phase (based on dermatology guidelines)
      const phaseStepTypes = {
        1: { // Foundation - basics only
          am: ['cleanser', 'moisturizer', 'sunscreen'],
          pm: ['cleanser', 'moisturizer', 'makeup_remover']
        },
        2: { // First Active - add one active
          am: ['cleanser', 'moisturizer', 'sunscreen'],
          pm: ['cleanser', 'serum', 'moisturizer', 'makeup_remover']
        },
        3: { // Build Tolerance - same as 2 but more frequent
          am: ['cleanser', 'moisturizer', 'sunscreen'],
          pm: ['cleanser', 'serum', 'moisturizer', 'makeup_remover', 'treatment']
        },
        4: { // Full Routine - everything
          am: ['cleanser', 'toner', 'serum', 'eye_cream', 'moisturizer', 'sunscreen'],
          pm: ['cleanser', 'makeup_remover', 'exfoliant', 'toner', 'serum', 'treatment', 'eye_cream', 'moisturizer', 'face_oil']
        }
      };

      const allowedSteps = phaseStepTypes[currentPhase] || phaseStepTypes[1];
      const allowedForTime = allowedSteps[time] || allowedSteps.am;

      // Filter steps based on current phase
      const filteredSteps = routine.steps.filter(step => {
        const stepType = step.stepType?.toLowerCase() || '';
        return allowedForTime.includes(stepType);
      });

      if (filteredSteps.length === 0) {
        this.renderEmptyRoutine();
        return;
      }

      // Calculate total time for filtered steps
      const totalSeconds = filteredSteps.reduce((sum, s) => sum + (s.durationSeconds || 30), 0);
      const totalMinutes = Math.ceil(totalSeconds / 60);

      // Render time header with phase indicator
      if (timeHeader) {
        timeHeader.style.display = 'block';
        const phaseNames = { 1: 'Foundation', 2: 'First Active', 3: 'Build Tolerance', 4: 'Full Routine' };
        timeHeader.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">' +
          '<span style="font-size:12px;color:#166534;font-weight:600;">Total Time: ' + totalMinutes + ' min</span>' +
          '<span style="font-size:11px;color:#16a34a;">' + filteredSteps.length + ' steps • Phase ' + currentPhase + '</span>' +
        '</div>';
      }

      // Render filtered steps with checkboxes
      let html = '';
      filteredSteps.forEach((step, i) => {
        const stepName = step.stepType ? step.stepType.replace(/_/g, ' ') : 'Step';
        const productName = step.customProductName || '';
        const instructions = step.instructions || '';
        const duration = step.durationSeconds || 30;
        const isOptional = step.isOptional || false;
        const frequency = step.frequency || 'daily';

        html += '<div class="flashai-routine-step" data-step-id="' + step.id + '" data-step-order="' + step.stepOrder + '" style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;transition:all 0.2s;">' +
          '<div style="width:36px;height:36px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;">' + (i + 1) + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:#18181b;text-transform:capitalize;">' + stepName + '</div>' +
            (productName ? '<div style="font-size:11px;color:#8b5cf6;margin-top:2px;">' + productName + '</div>' : '') +
            (instructions ? '<div style="font-size:10px;color:#71717a;margin-top:4px;line-height:1.4;">' + instructions + '</div>' : '') +
            '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">' +
              '<span style="font-size:10px;color:#a1a1aa;display:flex;align-items:center;gap:2px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ' + duration + 's</span>' +
              (isOptional ? '<span style="font-size:9px;padding:2px 6px;background:#f4f4f5;border-radius:4px;color:#71717a;">Optional</span>' : '') +
              (frequency !== 'daily' ? '<span style="font-size:9px;padding:2px 6px;background:#e0e7ff;border-radius:4px;color:#4f46e5;">' + frequency + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<button class="flashai-routine-check" data-step-order="' + step.stepOrder + '" style="width:32px;height:32px;background:#f4f4f5;border:2px solid #e4e4e7;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
          '</button>' +
        '</div>';
      });

      container.innerHTML = html;

      // Show complete button
      if (actionsContainer) {
        actionsContainer.style.display = 'block';
        actionsContainer.innerHTML = '<button id="flashai-vto-complete-routine" data-routine-id="' + routine.id + '" data-filtered-steps="' + filteredSteps.length + '" style="width:100%;padding:14px;background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 15px rgba(22,163,74,0.3);">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
          'Complete ' + (time === 'am' ? 'Morning' : 'Night') + ' Routine' +
        '</button>';
      }

      // Store filtered steps for completion tracking
      this.state.currentFilteredSteps = filteredSteps;

      // Attach event listeners
      this.attachRoutineEventListeners(routine.id);
    }

    attachRoutineEventListeners(routineId) {
      // Step checkboxes
      document.querySelectorAll('.flashai-routine-check').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const stepBtn = e.currentTarget;
          const isCompleted = stepBtn.dataset.completed === 'true';

          if (isCompleted) {
            stepBtn.dataset.completed = 'false';
            stepBtn.style.background = '#f4f4f5';
            stepBtn.style.borderColor = '#e4e4e7';
            stepBtn.querySelector('svg').setAttribute('stroke', '#a1a1aa');
            stepBtn.closest('.flashai-routine-step').style.opacity = '1';
          } else {
            stepBtn.dataset.completed = 'true';
            stepBtn.style.background = '#16a34a';
            stepBtn.style.borderColor = '#16a34a';
            stepBtn.querySelector('svg').setAttribute('stroke', '#fff');
            stepBtn.closest('.flashai-routine-step').style.opacity = '0.6';
          }
        });
      });

      // Complete routine button
      const completeBtn = document.getElementById('flashai-vto-complete-routine');
      if (completeBtn) {
        completeBtn.addEventListener('click', () => {
          this.logRoutineCompletion(routineId);
        });
      }
    }

    async logRoutineCompletion(routineId) {
      if (!this.state.authToken) return;

      // Gather completed steps
      const completedSteps = [];
      document.querySelectorAll('.flashai-routine-check[data-completed="true"]').forEach(btn => {
        completedSteps.push(parseInt(btn.dataset.stepOrder));
      });

      const completeBtn = document.getElementById('flashai-vto-complete-routine');
      if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:flashai-spin 1s linear infinite;"></span> Saving...';
      }

      try {
        const logUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/' + routineId + '/log';
        const response = await fetch(logUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.state.authToken
          },
          body: JSON.stringify({
            stepsCompleted: completedSteps,
            skinFeeling: 'good'
          })
        });

        const data = await response.json();
        if (data.success) {
          this.showRoutineCompletionSuccess(data.data.log);
        } else {
          throw new Error(data.message || 'Failed to log completion');
        }
      } catch (error) {
        console.error('[Routine] Error logging completion:', error);
        if (completeBtn) {
          completeBtn.disabled = false;
          completeBtn.innerHTML = 'Complete Routine';
        }
      }
    }

    showRoutineCompletionSuccess(log) {
      const container = document.getElementById('flashai-vto-routine-steps');
      const timeHeader = document.getElementById('flashai-vto-routine-time-header');
      const actionsContainer = document.getElementById('flashai-vto-routine-actions');

      if (timeHeader) timeHeader.style.display = 'none';
      if (actionsContainer) actionsContainer.style.display = 'none';

      if (container) {
        const stepsCount = log.stepsCompleted?.length || 0;
        const totalSteps = log.totalSteps || 0;
        const percent = log.completionPercent || 0;

        container.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
          '<div style="font-size:48px;margin-bottom:16px;">&#127881;</div>' +
          '<h3 style="font-size:18px;font-weight:700;color:#16a34a;margin:0 0 8px;">Routine Complete!</h3>' +
          '<p style="font-size:14px;color:#71717a;margin:0 0 20px;">Great job taking care of your skin</p>' +
          '<div style="display:inline-flex;gap:20px;padding:16px 24px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">' +
            '<div style="text-align:center;">' +
              '<div style="font-size:24px;font-weight:700;color:#16a34a;">' + stepsCount + '</div>' +
              '<div style="font-size:10px;color:#71717a;">Steps Done</div>' +
            '</div>' +
            '<div style="width:1px;background:#bbf7d0;"></div>' +
            '<div style="text-align:center;">' +
              '<div style="font-size:24px;font-weight:700;color:#16a34a;">' + percent + '%</div>' +
              '<div style="font-size:10px;color:#71717a;">Complete</div>' +
            '</div>' +
          '</div>' +
          '<button onclick="window.FlashAI_VTO.loadRoutineData()" style="margin-top:20px;padding:10px 24px;background:transparent;border:2px solid #16a34a;border-radius:8px;color:#16a34a;font-size:13px;font-weight:600;cursor:pointer;">View Routine Again</button>' +
        '</div>';
      }
    }

    renderEmptyRoutine() {
      const container = document.getElementById('flashai-vto-routine-steps');
      const timeHeader = document.getElementById('flashai-vto-routine-time-header');
      const actionsContainer = document.getElementById('flashai-vto-routine-actions');

      if (timeHeader) timeHeader.style.display = 'none';
      if (actionsContainer) actionsContainer.style.display = 'none';

      if (container) {
        container.innerHTML = '<div style="text-align:center;padding:30px 20px;color:#71717a;">' +
          '<div style="font-size:32px;margin-bottom:12px;">&#10024;</div>' +
          '<div style="font-size:14px;font-weight:500;">No routine yet</div>' +
          '<div style="font-size:12px;margin-top:4px;">Click "Generate My Routine" to get started</div>' +
        '</div>';
      }
    }

    async generateRoutine() {
      console.log('[Routine] generateRoutine called');

      if (!this.state.authToken) {
        console.log('[Routine] No auth token, showing auth modal');
        this.showAuthModal();
        return;
      }

      const btn = document.getElementById('flashai-vto-generate-routine');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:flashai-spin 1s linear infinite;"></span> Generating...</span>';
      }

      try {
        // Step 1: Check if user has active goals
        console.log('[Routine] Step 1: Checking for active goals...');
        const goalsUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/goals') + '?status=active';
        console.log('[Routine] Goals URL:', goalsUrl);
        const goalsResponse = await fetch(goalsUrl, {
          headers: { 'Authorization': 'Bearer ' + this.state.authToken }
        });
        const goalsData = await goalsResponse.json();
        console.log('[Routine] Goals response:', goalsData);

        // Step 2: If no goals, auto-create from scan first
        const hasGoals = goalsData.success && goalsData.data && goalsData.data.goals && goalsData.data.goals.length > 0;
        if (!hasGoals) {
          console.log('[Routine] Step 2: No active goals, creating from scan...');
          const createGoalsUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/goals') + '/from-scan';
          console.log('[Routine] Create goals URL:', createGoalsUrl);
          const createGoalsResponse = await fetch(createGoalsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + this.state.authToken
            }
          });
          const createGoalsData = await createGoalsResponse.json();
          console.log('[Routine] Create goals response:', createGoalsData);

          if (!createGoalsData.success) {
            console.warn('[Routine] Goal creation failed:', createGoalsData.error || createGoalsData.message);
            // Continue anyway - routine generation will use default templates
          }
        } else {
          console.log('[Routine] User has', goalsData.data.goals.length, 'active goals');
        }

        // Step 3: Generate routine based on goals
        console.log('[Routine] Step 3: Generating routine...');
        const generateUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/generate';
        console.log('[Routine] Generate URL:', generateUrl);
        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.state.authToken
          }
        });

        const data = await response.json();
        console.log('[Routine] Generate response:', data);

        if (data.success) {
          console.log('[Routine] Routine generated successfully, reloading data...');
          // Reload routine data to show the new routine
          await this.loadRoutineData();
        } else {
          throw new Error(data.error?.message || data.message || 'Failed to generate routine');
        }
      } catch (error) {
        console.error('[Routine] Error generating routine:', error);
        alert('Failed to generate routine: ' + (error.message || 'Unknown error'));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg> Generate My Routine</span>';
        }
      }
    }

    // ==========================================================================
    // PHASED ROUTINE SYSTEM - Questionnaire, Phase Banner, Calendar
    // ==========================================================================

    initQuestionnaireEvents() {
      const modal = this.elements.modal;

      // Single-select buttons
      modal.querySelectorAll('.flashai-questionnaire-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const question = e.currentTarget.dataset.question;
          const value = e.currentTarget.dataset.value;
          this.handleQuestionnaireAnswer(question, value, false);
        });
      });

      // Multi-select toggle buttons
      modal.querySelectorAll('.flashai-questionnaire-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const question = e.currentTarget.dataset.question;
          const value = e.currentTarget.dataset.value;
          this.handleQuestionnaireAnswer(question, value, true);
        });
      });

      // Submit button
      const submitBtn = modal.querySelector('#flashai-vto-questionnaire-submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => this.submitQuestionnaire());
      }

      // Calendar navigation
      modal.querySelector('#flashai-cal-prev')?.addEventListener('click', () => {
        this.navigateCalendar(-1);
      });
      modal.querySelector('#flashai-cal-next')?.addEventListener('click', () => {
        this.navigateCalendar(1);
      });

      // Advance phase button
      modal.querySelector('#flashai-vto-advance-phase')?.addEventListener('click', () => {
        this.advancePhase();
      });
    }

    handleQuestionnaireAnswer(question, value, isMultiSelect) {
      if (!this.state.questionnaireAnswers) {
        this.state.questionnaireAnswers = { usedActives: [] };
      }

      if (isMultiSelect) {
        // Toggle for multi-select (usedActives)
        if (value === 'none') {
          // If "none" selected, clear others
          this.state.questionnaireAnswers[question] = ['none'];
          document.querySelectorAll('.flashai-questionnaire-toggle[data-question="' + question + '"]').forEach(btn => {
            if (btn.dataset.value === 'none') {
              btn.style.background = '#8b5cf6';
              btn.style.color = '#fff';
              btn.style.borderColor = '#8b5cf6';
            } else {
              btn.style.background = '#fff';
              btn.style.color = '#18181b';
              btn.style.borderColor = '#e4e4e7';
            }
          });
        } else {
          // Remove "none" if selecting other
          this.state.questionnaireAnswers[question] = (this.state.questionnaireAnswers[question] || []).filter(v => v !== 'none');
          const index = this.state.questionnaireAnswers[question].indexOf(value);
          if (index > -1) {
            this.state.questionnaireAnswers[question].splice(index, 1);
          } else {
            this.state.questionnaireAnswers[question].push(value);
          }

          // Update button styles
          document.querySelectorAll('.flashai-questionnaire-toggle[data-question="' + question + '"]').forEach(btn => {
            const isSelected = this.state.questionnaireAnswers[question].includes(btn.dataset.value);
            btn.style.background = isSelected ? '#8b5cf6' : '#fff';
            btn.style.color = isSelected ? '#fff' : '#18181b';
            btn.style.borderColor = isSelected ? '#8b5cf6' : '#e4e4e7';
          });
        }
      } else {
        // Single select
        this.state.questionnaireAnswers[question] = value;

        // Update button styles
        document.querySelectorAll('.flashai-questionnaire-btn[data-question="' + question + '"]').forEach(btn => {
          if (btn.dataset.value === value) {
            btn.style.background = '#8b5cf6';
            btn.style.color = '#fff';
            btn.style.borderColor = '#8b5cf6';
          } else {
            btn.style.background = '#fff';
            btn.style.color = '#18181b';
            btn.style.borderColor = '#e4e4e7';
          }
        });
      }
    }

    async submitQuestionnaire() {
      const answers = this.state.questionnaireAnswers || {};

      // Validate required answers
      if (!answers.skincareExperience || !answers.skinSensitivity || !answers.routineConsistency) {
        alert('Please answer all questions to personalize your routine');
        return;
      }

      const submitBtn = document.getElementById('flashai-vto-questionnaire-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:flashai-spin 1s linear infinite;"></span> Creating your plan...';
      }

      try {
        const url = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/questionnaire';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.state.authToken
          },
          body: JSON.stringify({
            skincareExperience: answers.skincareExperience,
            skinSensitivity: answers.skinSensitivity,
            routineConsistency: answers.routineConsistency,
            usedActives: answers.usedActives || [],
            ageRange: answers.ageRange
          })
        });

        const data = await response.json();

        if (data.success) {
          // Hide questionnaire, show routine content
          const questionnaire = document.getElementById('flashai-vto-routine-questionnaire');
          const routineContent = document.getElementById('flashai-vto-routine-content');
          if (questionnaire) questionnaire.style.display = 'none';
          if (routineContent) routineContent.style.display = 'block';

          // Store phase and routines
          this.state.currentPhase = data.data.phase;
          this.state.routines = data.data.routines;

          // Render phase banner and routines
          this.renderPhaseBanner(data.data.phase);
          this.renderMilestoneTimeline(data.data.phase.phaseNumber);
          this.state.currentRoutineTime = 'am';
          this.renderRoutine('am');

          // Load calendar
          this.loadCalendarData();
        } else {
          throw new Error(data.message || 'Failed to create personalized routine');
        }
      } catch (error) {
        console.error('[Questionnaire] Error:', error);
        alert('Failed to create routine: ' + error.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Start My Personalized Routine';
        }
      }
    }

    async loadPhaseData() {
      if (!this.state.authToken) return null;

      try {
        const url = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/phase';
        const response = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + this.state.authToken }
        });
        const data = await response.json();
        return data.success ? data.data : null;
      } catch (error) {
        console.error('[Phase] Error loading phase:', error);
        return null;
      }
    }

    renderPhaseBanner(phaseInfo) {
      if (!phaseInfo || !phaseInfo.phase) return;

      const phase = phaseInfo.phase;
      const phaseNumber = document.getElementById('flashai-phase-number');
      const phaseName = document.getElementById('flashai-phase-name');
      const phaseWeek = document.getElementById('flashai-phase-week');
      const phaseProgress = document.getElementById('flashai-phase-progress');
      const phaseDescription = document.getElementById('flashai-phase-description');
      const phaseTipText = document.getElementById('flashai-phase-tip-text');
      const advanceBtn = document.getElementById('flashai-vto-advance-phase');

      if (phaseNumber) phaseNumber.textContent = phase.phaseNumber || 1;
      if (phaseName) phaseName.textContent = phase.phaseName || 'Foundation';
      if (phaseWeek) phaseWeek.textContent = phaseInfo.weekInPhase || 1;

      // Calculate progress
      const totalWeeks = phaseInfo.totalWeeks || 2;
      const currentWeek = phaseInfo.weekInPhase || 1;
      const progressPercent = Math.min(100, Math.round((currentWeek / totalWeeks) * 100));
      if (phaseProgress) phaseProgress.style.width = progressPercent + '%';

      // Phase descriptions
      const descriptions = {
        1: 'Build healthy habits with core essentials',
        2: 'Introduce your first treatment product slowly',
        3: 'Increase treatment frequency as skin adjusts',
        4: 'Your complete personalized routine'
      };
      if (phaseDescription) phaseDescription.textContent = descriptions[phase.phaseNumber] || '';

      // Tips
      const tips = [
        { text: 'Apply sunscreen every morning, even on cloudy days', icon: '☀️' },
        { text: 'Apply treatment serum before moisturizer', icon: '✨' },
        { text: 'Results take 4-8 weeks to show', icon: '⏰' },
        { text: 'Listen to your skin and adjust as needed', icon: '👂' }
      ];
      const tip = tips[(phase.phaseNumber || 1) - 1];
      const tipIcon = document.querySelector('#flashai-phase-tip span:first-child');
      if (tipIcon) tipIcon.textContent = tip.icon;
      if (phaseTipText) phaseTipText.textContent = tip.text;

      // Show advance button if ready
      if (advanceBtn) {
        const canAdvance = phaseInfo.canAdvance && phase.phaseNumber < 4;
        advanceBtn.style.display = canAdvance ? 'block' : 'none';
        if (canAdvance) {
          advanceBtn.textContent = 'Ready for Phase ' + (phase.phaseNumber + 1) + '? →';
        }
      }
    }

    renderMilestoneTimeline(currentPhase) {
      const milestones = document.querySelectorAll('.flashai-milestone');
      milestones.forEach(m => {
        const phaseNum = parseInt(m.dataset.phase);
        const circle = m.querySelector('div');
        const label = m.querySelector('span');

        if (phaseNum < currentPhase) {
          // Completed
          circle.style.background = '#8b5cf6';
          circle.style.color = '#fff';
          circle.innerHTML = '✓';
          label.style.color = '#8b5cf6';
          label.style.fontWeight = '600';
        } else if (phaseNum === currentPhase) {
          // Current
          circle.style.background = 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)';
          circle.style.color = '#fff';
          circle.style.boxShadow = '0 0 0 4px rgba(139,92,246,0.3)';
          circle.innerHTML = phaseNum;
          label.style.color = '#8b5cf6';
          label.style.fontWeight = '600';
        } else {
          // Future
          circle.style.background = '#e4e4e7';
          circle.style.color = '#71717a';
          circle.style.boxShadow = 'none';
          circle.innerHTML = phaseNum;
          label.style.color = '#71717a';
          label.style.fontWeight = '400';
        }
      });
    }

    async loadCalendarData(month) {
      if (!this.state.authToken) return;

      const monthStr = month || new Date().toISOString().slice(0, 7);
      this.state.currentCalendarMonth = monthStr;

      try {
        const url = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/calendar?month=' + monthStr;
        const response = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + this.state.authToken }
        });
        const data = await response.json();

        if (data.success) {
          this.renderCalendar(data.data);
        }
      } catch (error) {
        console.error('[Calendar] Error loading calendar:', error);
      }
    }

    renderCalendar(calendarData) {
      const monthLabel = document.getElementById('flashai-cal-month');
      const grid = document.getElementById('flashai-cal-grid');
      const streakEl = document.getElementById('flashai-cal-streak');
      const monthlyEl = document.getElementById('flashai-cal-monthly');

      if (!calendarData || !grid) return;

      // Update month label
      if (monthLabel) {
        const date = new Date(calendarData.month + '-01');
        monthLabel.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      // Update stats
      if (streakEl) streakEl.textContent = calendarData.stats?.currentStreak || 0;
      if (monthlyEl) {
        const percent = calendarData.stats?.totalDays > 0
          ? Math.round((calendarData.stats.completedDays / calendarData.stats.totalDays) * 100)
          : 0;
        monthlyEl.textContent = percent + '%';
      }

      // Build calendar grid
      const days = calendarData.days || [];
      const firstDay = new Date(calendarData.month + '-01');
      const startDay = firstDay.getDay(); // 0=Sun, 1=Mon, etc.
      const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();

      let html = '';

      // Empty cells before first day
      for (let i = 0; i < startDay; i++) {
        html += '<div style="aspect-ratio:1;"></div>';
      }

      // Day cells
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calendarData.month + '-' + String(d).padStart(2, '0');
        const dayData = days.find(day => day.date === dateStr);
        const isToday = new Date().toISOString().slice(0, 10) === dateStr;
        const isFuture = new Date(dateStr) > new Date();

        let bgColor = '#f9fafb';
        let amDot = '#e4e4e7';
        let pmDot = '#e4e4e7';

        if (dayData && !isFuture) {
          if (dayData.am?.completed && dayData.pm?.completed) {
            bgColor = '#dcfce7';
            amDot = '#16a34a';
            pmDot = '#16a34a';
          } else if (dayData.am?.completed || dayData.pm?.completed) {
            bgColor = '#fef3c7';
            amDot = dayData.am?.completed ? '#16a34a' : '#e4e4e7';
            pmDot = dayData.pm?.completed ? '#16a34a' : '#e4e4e7';
          }
        }

        const todayStyle = isToday ? 'border:2px solid #8b5cf6;' : '';
        const futureStyle = isFuture ? 'opacity:0.4;' : '';

        html += '<div style="aspect-ratio:1;background:' + bgColor + ';border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;' + todayStyle + futureStyle + '">' +
          '<span style="font-size:11px;font-weight:' + (isToday ? '700' : '500') + ';color:' + (isToday ? '#8b5cf6' : '#18181b') + ';">' + d + '</span>' +
          '<div style="display:flex;gap:3px;margin-top:2px;">' +
          '<span style="width:5px;height:5px;background:' + amDot + ';border-radius:50%;"></span>' +
          '<span style="width:5px;height:5px;background:' + pmDot + ';border-radius:50%;"></span>' +
          '</div>' +
          '</div>';
      }

      grid.innerHTML = html;
    }

    navigateCalendar(direction) {
      const currentMonth = this.state.currentCalendarMonth || new Date().toISOString().slice(0, 7);
      const date = new Date(currentMonth + '-01');
      date.setMonth(date.getMonth() + direction);
      const newMonth = date.toISOString().slice(0, 7);
      this.loadCalendarData(newMonth);
    }

    async advancePhase() {
      if (!this.state.authToken) return;

      const advanceBtn = document.getElementById('flashai-vto-advance-phase');
      if (advanceBtn) {
        advanceBtn.disabled = true;
        advanceBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:flashai-spin 1s linear infinite;"></span> Advancing...';
      }

      try {
        const url = this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines') + '/phase/advance';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.state.authToken
          },
          body: JSON.stringify({ reason: 'manual' })
        });

        const data = await response.json();

        if (data.success) {
          // Reload routine data with new phase
          await this.loadRoutineData();
        } else {
          throw new Error(data.message || 'Failed to advance phase');
        }
      } catch (error) {
        console.error('[Phase] Error advancing:', error);
        alert('Failed to advance phase: ' + error.message);
      } finally {
        if (advanceBtn) {
          advanceBtn.disabled = false;
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
        'skin-context': 'flashai-vto-step-skin-context',
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

      // CRITICAL: Detect actual face bounds before positioning any markers
      // This prevents markers from appearing outside the face
      this.detectFaceBounds().then(bounds => {
        this.state.faceBounds = bounds;
        console.log('[Face Detection] Detected bounds:', bounds);

        // Generate detected issues with numbered pins AFTER face detection
        this.generateDetectedIssues(scan.analysis);
      });

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

    /**
     * FACE DETECTION: Detect actual face bounding box from the captured image
     * This ensures markers are only placed within the face region, not outside it
     * Uses skin color detection and contour analysis
     */
    async detectFaceBounds() {
      return new Promise((resolve) => {
        const faceImg = document.getElementById('flashai-vto-face-image');

        if (!faceImg || !faceImg.complete || faceImg.naturalWidth === 0) {
          console.warn('[Face Detection] Image not ready, using default bounds');
          resolve(this.getDefaultFaceBounds());
          return;
        }

        try {
          // Create a canvas to analyze the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = faceImg.naturalWidth;
          canvas.height = faceImg.naturalHeight;
          ctx.drawImage(faceImg, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const bounds = this.analyzeFaceRegion(imageData, canvas.width, canvas.height);

          console.log('[Face Detection] Analyzed bounds:', bounds);
          resolve(bounds);
        } catch (error) {
          console.error('[Face Detection] Error:', error);
          resolve(this.getDefaultFaceBounds());
        }
      });
    }

    /**
     * Analyze image to find face region using skin color detection
     * Returns bounding box as percentages of image dimensions
     */
    analyzeFaceRegion(imageData, width, height) {
      const data = imageData.data;
      const skinPixels = [];

      // Scan image for skin-colored pixels
      for (let y = 0; y < height; y += 4) { // Sample every 4th row for performance
        for (let x = 0; x < width; x += 4) { // Sample every 4th column
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if pixel is skin-colored using multiple color space checks
          if (this.isSkinColor(r, g, b)) {
            skinPixels.push({ x, y });
          }
        }
      }

      if (skinPixels.length < 100) {
        console.warn('[Face Detection] Not enough skin pixels detected, using default');
        return this.getDefaultFaceBounds();
      }

      // Find bounding box of skin pixels
      let minX = width, maxX = 0, minY = height, maxY = 0;
      skinPixels.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });

      // Add padding and constrain to reasonable face proportions
      const padding = 0.05; // 5% padding
      const rawWidth = maxX - minX;
      const rawHeight = maxY - minY;

      // Apply padding
      minX = Math.max(0, minX - rawWidth * padding);
      maxX = Math.min(width, maxX + rawWidth * padding);
      minY = Math.max(0, minY - rawHeight * padding);
      maxY = Math.min(height, maxY + rawHeight * padding);

      // Convert to percentages
      const bounds = {
        x: (minX / width) * 100,
        y: (minY / height) * 100,
        width: ((maxX - minX) / width) * 100,
        height: ((maxY - minY) / height) * 100,
        centerX: ((minX + maxX) / 2 / width) * 100,
        centerY: ((minY + maxY) / 2 / height) * 100,
        detected: true
      };

      // Sanity checks - face should be reasonable size
      if (bounds.width < 20 || bounds.height < 25 || bounds.width > 95 || bounds.height > 95) {
        console.warn('[Face Detection] Bounds seem unreasonable, using default');
        return this.getDefaultFaceBounds();
      }

      return bounds;
    }

    /**
     * Check if RGB color is likely skin tone
     * Uses multiple color space checks for robustness across skin tones
     */
    isSkinColor(r, g, b) {
      // Rule 1: RGB ranges (works for many skin tones)
      const rgbRule = r > 60 && g > 40 && b > 20 &&
                      r > g && r > b &&
                      Math.abs(r - g) > 10 &&
                      r - b > 15;

      // Rule 2: Normalized RGB (handles lighting variations)
      const sum = r + g + b;
      if (sum < 100) return false; // Too dark

      const rn = r / sum;
      const gn = g / sum;
      const bn = b / sum;
      const normalizedRule = rn > 0.35 && rn < 0.55 &&
                            gn > 0.25 && gn < 0.42 &&
                            bn > 0.15 && bn < 0.35;

      // Rule 3: YCbCr color space (robust for skin detection)
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.169 * r - 0.331 * g + 0.500 * b;
      const cr = 128 + 0.500 * r - 0.419 * g - 0.081 * b;
      const ycbcrRule = y > 60 && cb > 77 && cb < 127 && cr > 133 && cr < 173;

      // Return true if at least 2 rules match
      const matches = [rgbRule, normalizedRule, ycbcrRule].filter(Boolean).length;
      return matches >= 2;
    }

    /**
     * Default face bounds when detection fails
     * Assumes face is roughly centered in the capture oval
     */
    getDefaultFaceBounds() {
      return {
        x: 15,      // 15% from left
        y: 10,      // 10% from top
        width: 70,  // 70% of image width
        height: 80, // 80% of image height
        centerX: 50,
        centerY: 50,
        detected: false
      };
    }

    /**
     * Convert a face-relative position to image-absolute position
     * @param {Object} facePos - Position as % of face area {x, y}
     * @param {Object} bounds - Face bounds {x, y, width, height}
     * @returns {Object} Position as % of image area {x, y}
     */
    faceToImagePosition(facePos, bounds) {
      // facePos.x is % within face, bounds.x is face left edge % of image
      // Convert: imageX = bounds.x + (facePos.x / 100) * bounds.width
      return {
        x: bounds.x + (facePos.x / 100) * bounds.width,
        y: bounds.y + (facePos.y / 100) * bounds.height
      };
    }

    /**
     * Convert a face-relative region to image-absolute region
     * @param {Object} faceRegion - Region as % of face area {x, y, w, h}
     * @param {Object} bounds - Face bounds {x, y, width, height}
     * @returns {Object} Region as % of image area {x, y, w, h}
     */
    faceToImageRegion(faceRegion, bounds) {
      return {
        x: bounds.x + (faceRegion.x / 100) * bounds.width,
        y: bounds.y + (faceRegion.y / 100) * bounds.height,
        w: (faceRegion.w / 100) * bounds.width,
        h: (faceRegion.h / 100) * bounds.height
      };
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

      // ========== GET FACE BOUNDS ==========
      // Use detected face bounds to position markers ONLY within the face
      const faceBounds = this.state.faceBounds || this.getDefaultFaceBounds();
      console.log('[Issues] Using face bounds:', faceBounds);

      // ========== SKIN CONTEXT CALIBRATION ==========
      // Apply adjustments based on user's pre-scan questionnaire answers
      // This reduces false positives by accounting for natural features
      const skinContext = this.state.skinContext || {};
      const calibration = this.calculateCalibrationFactors(skinContext, analysis);

      console.log('[Skin Analysis] Applying calibration:', calibration);

      // Define ALL attributes with FACE-RELATIVE positions (0-100% of face area)
      // These positions are relative to the FACE, not the entire image
      // They will be converted to image coordinates using faceBounds
      // CALIBRATED THRESHOLDS: Increased to reduce false positives
      const issueConfigs = [
        {
          key: 'dark_circles',
          threshold: 15, // LOWERED: More sensitive detection for dark circles
          facePosition: { x: 50, y: 35 }, // FACE-RELATIVE: center-ish, upper-mid (under eyes)
          region: 'Under Eyes',
          faceHighlight: { x: 20, y: 28, w: 60, h: 15 }
        },
        {
          key: 'wrinkles',
          threshold: 25,
          facePosition: { x: 50, y: 12 }, // FACE-RELATIVE: top center (forehead)
          region: 'Forehead & Eyes',
          faceHighlight: { x: 15, y: 5, w: 70, h: 25 }
        },
        {
          key: 'pores',
          threshold: 30,
          facePosition: { x: 50, y: 50 }, // FACE-RELATIVE: center (nose area)
          region: 'T-Zone (Nose)',
          faceHighlight: { x: 35, y: 40, w: 30, h: 25 }
        },
        {
          key: 'acne',
          threshold: 35,
          facePosition: { x: 72, y: 55 }, // FACE-RELATIVE: right cheek area
          region: 'Cheeks & Chin',
          faceHighlight: { x: 15, y: 45, w: 70, h: 35 }
        },
        {
          key: 'redness',
          threshold: 40,
          facePosition: { x: 28, y: 52 }, // FACE-RELATIVE: left cheek
          region: 'Cheeks',
          faceHighlight: { x: 10, y: 40, w: 80, h: 30 }
        },
        {
          key: 'oiliness',
          threshold: 40,
          facePosition: { x: 50, y: 25 }, // FACE-RELATIVE: T-zone upper
          region: 'T-Zone',
          faceHighlight: { x: 30, y: 10, w: 40, h: 50 }
        },
        {
          key: 'pigmentation',
          threshold: 35,
          facePosition: { x: 75, y: 45 }, // FACE-RELATIVE: right side
          region: 'Cheeks & Forehead',
          faceHighlight: { x: 15, y: 25, w: 70, h: 40 }
        },
        {
          key: 'hydration',
          threshold: 50,
          isInverse: true,
          facePosition: { x: 50, y: 70 }, // FACE-RELATIVE: lower center
          region: 'Full Face',
          faceHighlight: { x: 10, y: 10, w: 80, h: 80 }
        },
        {
          key: 'texture',
          threshold: 30,
          facePosition: { x: 35, y: 48 }, // FACE-RELATIVE: left-center
          region: 'Overall Skin',
          faceHighlight: { x: 15, y: 20, w: 70, h: 60 }
        }
      ];

      issueConfigs.forEach(config => {
        const attr = attrs[config.key];
        if (!attr) return;

        let rawScore = attr.getScore(analysis);

        // ========== APPLY CALIBRATION ==========
        // Adjust scores based on user's skin context
        const calFactor = calibration[config.key] || 1.0;
        let score = rawScore;

        if (calFactor !== 1.0) {
          // For "bad" attributes, reduce the score (multiply by factor < 1)
          if (!config.isInverse) {
            score = Math.max(0, Math.round(score * calFactor));
          }
          console.log(`[Calibration] ${config.key}: ${rawScore} → ${score} (factor: ${calFactor})`);
        }

        // ========== GET CLINICAL GRADE ==========
        // Use internationally recognized dermatology grading scales
        // IGA for acne, Glogau for wrinkles, CEA for redness, POH for dark circles
        const clinicalGrade = this.getClinicalGrade(config.key, score, analysis);

        // Dynamic threshold adjustment based on context
        let adjustedThreshold = config.threshold;

        // If user confirmed they have a condition that explains the detection, raise threshold more
        if (calibration.knownConditions && calibration.knownConditions.includes(config.key)) {
          adjustedThreshold = Math.min(90, config.threshold + 30); // Much higher threshold for known conditions
          console.log(`[Calibration] ${config.key} threshold raised to ${adjustedThreshold} (known condition)`);
        }

        // Use clinical grade to determine if it's a concern
        // Grade 0-1 = Good, Grade 2 = Moderate, Grade 3-4 = Concern
        let severity, severityLabel;
        if (clinicalGrade.isGood) {
          // For good attributes like hydration, higher grade is better
          severity = clinicalGrade.grade >= 3 ? 'good' : clinicalGrade.grade >= 2 ? 'moderate' : 'concern';
          severityLabel = clinicalGrade.label;
        } else {
          // For concerns, lower grade is better
          severity = clinicalGrade.grade <= 1 ? 'good' : clinicalGrade.grade <= 2 ? 'moderate' : 'concern';
          severityLabel = clinicalGrade.label;
        }

        const meetsThreshold = clinicalGrade.isGood
          ? clinicalGrade.grade < 2  // For hydration: concern if grade < 2
          : clinicalGrade.grade >= 2; // For concerns: concern if grade >= 2

        // ========== CONVERT FACE-RELATIVE TO IMAGE-ABSOLUTE POSITIONS ==========
        // This ensures markers appear WITHIN the detected face, not outside it
        const imagePosition = this.faceToImagePosition(config.facePosition, faceBounds);
        const imageHighlight = this.faceToImageRegion(config.faceHighlight, faceBounds);

        // ALWAYS add all attributes - show complete picture
        // Mark whether it's a concern (meets threshold) or healthy metric
        issues.push({
          key: config.key,
          name: attr.name,
          icon: attr.icon,
          score: Math.round(score),
          clinicalGrade: clinicalGrade, // NEW: Clinical grading info
          severity,
          severityLabel,
          isConcern: meetsThreshold, // Flag to identify if this is a concern or healthy
          isGoodAttribute: attr.isGood || false,
          region: config.region,
          position: imagePosition,           // Now in IMAGE coordinates
          highlightRegion: imageHighlight,   // Now in IMAGE coordinates
          problem: attr.getProblem(analysis, score),
          solution: attr.getSolution(analysis, score),
          ingredients: attr.getIngredients ? attr.getIngredients() : '',
          usage: attr.getUsage ? attr.getUsage() : '',
          products: attr.getProducts ? attr.getProducts() : []
        });
      });

      // Sort: concerns first (by severity), then healthy metrics
      const severityOrder = { concern: 0, moderate: 1, good: 2 };
      issues.sort((a, b) => {
        // First sort by concern status (concerns first)
        if (a.isConcern !== b.isConcern) {
          return a.isConcern ? -1 : 1;
        }
        // Then by severity
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      this.state.detectedIssues = issues;
      this.renderIssuesList();
    }

    // ========================================================================
    // CLINICAL DERMATOLOGY GRADING SCALES
    // ========================================================================
    // Using internationally recognized clinical assessment standards:
    // - IGA (Investigator's Global Assessment) - FDA approved for acne
    // - Glogau Scale - Photoaging/wrinkles classification
    // - CEA (Clinician's Erythema Assessment) - Redness grading
    // - POH Grading (Sheth et al.) - Periorbital hyperpigmentation
    // - Hydration Assessment Scale - Skin moisture levels
    // ========================================================================

    /**
     * Get clinical grade for a skin concern using dermatology standards
     * Returns: { grade: number, label: string, description: string, scale: string }
     */
    getClinicalGrade(attribute, rawScore, analysis = {}) {
      const score = Math.max(0, Math.min(100, rawScore || 0));

      // ========== ACNE: IGA Scale (FDA Approved) ==========
      // Investigator's Global Assessment - 5-point scale (0-4)
      // Reference: US FDA 2005, PMC10995619
      if (attribute === 'acne') {
        const lesionCount = (analysis.whitehead_count || 0) + (analysis.blackhead_count || 0) + (analysis.pimple_count || 0);
        let grade, label, description;

        if (score < 10 && lesionCount === 0) {
          grade = 0; label = 'Clear'; description = 'No evidence of acne';
        } else if (score < 25 || lesionCount <= 2) {
          grade = 1; label = 'Almost Clear'; description = 'Rare non-inflammatory lesions';
        } else if (score < 50 || lesionCount <= 10) {
          grade = 2; label = 'Mild'; description = 'Some non-inflammatory lesions, few inflammatory';
        } else if (score < 75 || lesionCount <= 20) {
          grade = 3; label = 'Moderate'; description = 'Many non-inflammatory and inflammatory lesions';
        } else {
          grade = 4; label = 'Severe'; description = 'Numerous lesions, nodules may be present';
        }

        return { grade, label, description, scale: 'IGA', maxGrade: 4 };
      }

      // ========== WRINKLES: Glogau Photoaging Scale ==========
      // Classification I-IV based on photoaging severity
      // Reference: Dr. Richard Glogau, Aesthetic Surgery Journal
      if (attribute === 'wrinkles') {
        const fineLines = analysis.fine_lines_count || 0;
        const deepWrinkles = analysis.deep_wrinkles_count || 0;
        let grade, label, description;

        if (score < 20 && deepWrinkles === 0) {
          grade = 1; label = 'Type I'; description = 'No wrinkles - Early photoaging, mild pigment changes';
        } else if (score < 45 || deepWrinkles <= 2) {
          grade = 2; label = 'Type II'; description = 'Wrinkles in motion - Early senile lentigines';
        } else if (score < 70) {
          grade = 3; label = 'Type III'; description = 'Wrinkles at rest - Obvious dyschromia, telangiectasia';
        } else {
          grade = 4; label = 'Type IV'; description = 'Only wrinkles - Severe photoaging';
        }

        return { grade, label, description, scale: 'Glogau', maxGrade: 4 };
      }

      // ========== REDNESS: CEA Scale ==========
      // Clinician's Erythema Assessment - 5-point scale (0-4)
      // Reference: JAAD, Rosacea.org
      if (attribute === 'redness') {
        let grade, label, description;

        if (score < 15) {
          grade = 0; label = 'Clear'; description = 'No signs of erythema';
        } else if (score < 35) {
          grade = 1; label = 'Almost Clear'; description = 'Slight redness';
        } else if (score < 55) {
          grade = 2; label = 'Mild'; description = 'Mild redness';
        } else if (score < 75) {
          grade = 3; label = 'Moderate'; description = 'Moderate redness';
        } else {
          grade = 4; label = 'Severe'; description = 'Severe redness';
        }

        return { grade, label, description, scale: 'CEA', maxGrade: 4 };
      }

      // ========== DARK CIRCLES: POH Grading (Sheth et al. 2014) ==========
      // Periorbital Hyperpigmentation - 4-point scale (1-4)
      // Reference: Indian Dermatology Online Journal
      // ADJUSTED: More sensitive thresholds - dark circles are common and often missed
      if (attribute === 'dark_circles') {
        let grade, label, description;

        if (score < 10) {
          grade = 0; label = 'None'; description = 'No visible dark circles';
        } else if (score < 25) {
          grade = 1; label = 'Grade 1'; description = 'Mild - Faint discoloration';
        } else if (score < 45) {
          grade = 2; label = 'Grade 2'; description = 'Moderate - Noticeable discoloration';
        } else if (score < 65) {
          grade = 3; label = 'Grade 3'; description = 'Moderately Severe - Distinct discoloration';
        } else {
          grade = 4; label = 'Grade 4'; description = 'Severe - Deep, prominent discoloration';
        }

        return { grade, label, description, scale: 'POH', maxGrade: 4 };
      }

      // ========== PIGMENTATION: Hyperpigmentation Assessment ==========
      // Based on MASI (Melasma Area Severity Index) principles
      if (attribute === 'pigmentation') {
        const darkSpots = analysis.dark_spots_count || 0;
        let grade, label, description;

        if (score < 15 && darkSpots <= 1) {
          grade = 0; label = 'Clear'; description = 'Even skin tone';
        } else if (score < 35) {
          grade = 1; label = 'Minimal'; description = 'Slight uneven tone';
        } else if (score < 55) {
          grade = 2; label = 'Mild'; description = 'Some visible spots or uneven areas';
        } else if (score < 75) {
          grade = 3; label = 'Moderate'; description = 'Noticeable pigmentation concerns';
        } else {
          grade = 4; label = 'Significant'; description = 'Prominent pigmentation issues';
        }

        return { grade, label, description, scale: 'HPA', maxGrade: 4 };
      }

      // ========== HYDRATION: Corneometer Scale Adaptation ==========
      // Based on professional skin hydration measurements
      // Higher is better for hydration
      if (attribute === 'hydration') {
        let grade, label, description;

        if (score >= 70) {
          grade = 4; label = 'Well Hydrated'; description = 'Excellent moisture levels';
        } else if (score >= 50) {
          grade = 3; label = 'Normal'; description = 'Adequate hydration';
        } else if (score >= 30) {
          grade = 2; label = 'Slightly Dry'; description = 'Could use more moisture';
        } else if (score >= 15) {
          grade = 1; label = 'Dry'; description = 'Needs hydration';
        } else {
          grade = 0; label = 'Very Dry'; description = 'Significantly dehydrated';
        }

        return { grade, label, description, scale: 'Hydration', maxGrade: 4, isGood: true };
      }

      // ========== PORES: Pore Visibility Scale ==========
      if (attribute === 'pores') {
        const enlargedPores = analysis.enlarged_pores_count || 0;
        let grade, label, description;

        if (score < 20 && enlargedPores <= 5) {
          grade = 0; label = 'Refined'; description = 'Minimal pore visibility';
        } else if (score < 40) {
          grade = 1; label = 'Normal'; description = 'Normal pore appearance';
        } else if (score < 60) {
          grade = 2; label = 'Visible'; description = 'Moderately visible pores';
        } else if (score < 80) {
          grade = 3; label = 'Enlarged'; description = 'Noticeably enlarged pores';
        } else {
          grade = 4; label = 'Very Enlarged'; description = 'Significantly enlarged pores';
        }

        return { grade, label, description, scale: 'PVS', maxGrade: 4 };
      }

      // ========== OILINESS: Sebum Assessment ==========
      if (attribute === 'oiliness') {
        let grade, label, description;

        if (score < 20) {
          grade = 0; label = 'Balanced'; description = 'Normal sebum levels';
        } else if (score < 40) {
          grade = 1; label = 'Slightly Oily'; description = 'Minor excess oil';
        } else if (score < 60) {
          grade = 2; label = 'Oily'; description = 'Moderate oiliness';
        } else if (score < 80) {
          grade = 3; label = 'Very Oily'; description = 'High sebum production';
        } else {
          grade = 4; label = 'Excessively Oily'; description = 'Excessive sebum production';
        }

        return { grade, label, description, scale: 'SAS', maxGrade: 4 };
      }

      // ========== TEXTURE: Skin Texture Assessment ==========
      if (attribute === 'texture') {
        let grade, label, description;

        if (score < 20) {
          grade = 0; label = 'Smooth'; description = 'Excellent skin texture';
        } else if (score < 40) {
          grade = 1; label = 'Good'; description = 'Minor texture variations';
        } else if (score < 60) {
          grade = 2; label = 'Uneven'; description = 'Moderate texture concerns';
        } else if (score < 80) {
          grade = 3; label = 'Rough'; description = 'Noticeable roughness';
        } else {
          grade = 4; label = 'Very Rough'; description = 'Significant texture issues';
        }

        return { grade, label, description, scale: 'STA', maxGrade: 4 };
      }

      // Default fallback
      return {
        grade: Math.round(score / 25),
        label: score < 25 ? 'Minimal' : score < 50 ? 'Mild' : score < 75 ? 'Moderate' : 'Notable',
        description: '',
        scale: 'General',
        maxGrade: 4
      };
    }

    /**
     * Legacy method - kept for backward compatibility
     * Now uses clinical grading internally
     */
    normalizeDisplayScore(rawScore, isGoodAttribute = false) {
      if (rawScore === 0) return 0;
      if (rawScore === null || rawScore === undefined) return 0;
      const clamped = Math.max(0, Math.min(100, rawScore));

      // For display purposes, we now use clinical grades
      // This method returns a normalized score for progress bars
      if (isGoodAttribute) {
        return clamped; // Keep as-is for good attributes
      }

      // For concerns, normalize to 0-100 but cap at 85
      return Math.min(85, clamped);
    }

    // ========================================================================
    // SKIN CONTEXT CALIBRATION & 4x4 GRID ANALYSIS
    // ========================================================================

    /**
     * Calculate calibration factors based on user's pre-scan questionnaire
     * Returns multipliers for each issue type (< 1.0 reduces score)
     */
    calculateCalibrationFactors(skinContext, analysis) {
      const factors = {};
      const knownConditions = [];

      // ====== FRECKLES CALIBRATION ======
      // If user has freckles, reduce pigmentation and acne scores
      // Freckles are often misdetected as dark spots or acne
      if (skinContext.freckles === 'many') {
        factors.pigmentation = 0.4; // Reduce by 60%
        factors.acne = 0.5;         // Reduce by 50%
        console.log('[Calibration] Many freckles → significantly reducing pigmentation/acne scores');
      } else if (skinContext.freckles === 'some') {
        factors.pigmentation = 0.6; // Reduce by 40%
        factors.acne = 0.7;         // Reduce by 30%
        console.log('[Calibration] Some freckles → moderately reducing pigmentation/acne scores');
      }

      // ====== KNOWN CONDITIONS CALIBRATION ======
      // If user has rosacea, acknowledge redness as condition, not just "redness"
      if (skinContext.conditions && skinContext.conditions.length > 0) {
        if (skinContext.conditions.includes('rosacea')) {
          factors.redness = 0.3; // Significantly reduce - they know about it
          knownConditions.push('redness');
          console.log('[Calibration] Rosacea → reducing redness score significantly');
        }
        if (skinContext.conditions.includes('melasma')) {
          factors.pigmentation = Math.min(factors.pigmentation || 1.0, 0.4);
          knownConditions.push('pigmentation');
          console.log('[Calibration] Melasma → reducing pigmentation score');
        }
        if (skinContext.conditions.includes('eczema')) {
          factors.texture = 0.6;
          factors.redness = Math.min(factors.redness || 1.0, 0.6);
          knownConditions.push('texture');
          console.log('[Calibration] Eczema → reducing texture/redness scores');
        }
        if (skinContext.conditions.includes('psoriasis')) {
          factors.texture = Math.min(factors.texture || 1.0, 0.5);
          factors.redness = Math.min(factors.redness || 1.0, 0.5);
          knownConditions.push('texture');
          console.log('[Calibration] Psoriasis → reducing texture/redness scores');
        }
      }

      // ====== SKIN TYPE CALIBRATION ======
      // Adjust for natural skin characteristics
      if (skinContext.skinType === 'oily') {
        factors.oiliness = 0.7; // They know their skin is oily
        factors.pores = 0.8;    // Oily skin often has larger pores naturally
        console.log('[Calibration] Oily skin type → reducing oiliness/pore scores');
      } else if (skinContext.skinType === 'dry') {
        factors.hydration = 1.2; // Be more sensitive to hydration issues
        console.log('[Calibration] Dry skin type → increasing hydration sensitivity');
      }

      // ====== SENSITIVITY CALIBRATION ======
      // Sensitive skin naturally shows more redness
      if (skinContext.sensitivity === 'very') {
        factors.redness = Math.min(factors.redness || 1.0, 0.5);
        console.log('[Calibration] Very sensitive → significantly reducing redness score');
      } else if (skinContext.sensitivity === 'slightly') {
        factors.redness = Math.min(factors.redness || 1.0, 0.75);
        console.log('[Calibration] Slightly sensitive → moderately reducing redness score');
      }

      // ====== 4x4 GRID REGIONAL ANALYSIS ======
      // Analyze detection patterns to differentiate freckles from acne
      if (analysis && (analysis.acne_locations || analysis.dark_spots_locations)) {
        const gridAnalysis = this.perform4x4GridAnalysis(analysis);

        if (gridAnalysis.isLikelyFreckles) {
          factors.acne = Math.min(factors.acne || 1.0, 0.4);
          factors.pigmentation = Math.min(factors.pigmentation || 1.0, 0.4);
          console.log('[Grid Analysis] Pattern suggests freckles, not acne → reducing scores');
        }

        if (gridAnalysis.uniformDistribution) {
          // Uniform distribution across face suggests natural features, not breakouts
          factors.acne = Math.min(factors.acne || 1.0, 0.6);
          console.log('[Grid Analysis] Uniform distribution suggests natural features');
        }

        // Store grid analysis for display
        this.state.regionalAnalysis = gridAnalysis;
      }

      factors.knownConditions = knownConditions;
      return factors;
    }

    /**
     * 4x4 Grid Regional Analysis
     * Divides face into 16 regions and analyzes patterns to differentiate:
     * - Freckles (uniform, small, many) vs Acne (clustered, varied sizes)
     * - Natural skin variations vs actual concerns
     */
    perform4x4GridAnalysis(analysis) {
      const result = {
        gridScores: Array(16).fill(null).map(() => ({
          acneCount: 0,
          darkSpotCount: 0,
          avgSize: 0,
          confidence: 0
        })),
        isLikelyFreckles: false,
        uniformDistribution: false,
        clusterDetected: false,
        confidenceScore: 0
      };

      // Collect all detected spots
      const allSpots = [];

      // Process acne locations
      if (analysis.acne_locations) {
        analysis.acne_locations.forEach(loc => {
          if (loc.x >= 0 && loc.x <= 1 && loc.y >= 0 && loc.y <= 1) {
            allSpots.push({
              x: loc.x,
              y: loc.y,
              type: 'acne',
              size: loc.size === 'large' ? 3 : loc.size === 'medium' ? 2 : 1
            });
          }
        });
      }

      // Process dark spots
      if (analysis.dark_spots_locations) {
        analysis.dark_spots_locations.forEach(loc => {
          if (loc.x >= 0 && loc.x <= 1 && loc.y >= 0 && loc.y <= 1) {
            allSpots.push({
              x: loc.x,
              y: loc.y,
              type: 'darkspot',
              size: (loc.size || 0.02) * 50 // Normalize size
            });
          }
        });
      }

      if (allSpots.length < 3) {
        // Not enough data for pattern analysis
        result.confidenceScore = 0.3;
        return result;
      }

      // Assign spots to 4x4 grid cells
      allSpots.forEach(spot => {
        const gridX = Math.min(3, Math.floor(spot.x * 4));
        const gridY = Math.min(3, Math.floor(spot.y * 4));
        const cellIndex = gridY * 4 + gridX;

        if (cellIndex >= 0 && cellIndex < 16) {
          const cell = result.gridScores[cellIndex];
          if (spot.type === 'acne') cell.acneCount++;
          else cell.darkSpotCount++;
          cell.avgSize = (cell.avgSize * (cell.acneCount + cell.darkSpotCount - 1) + spot.size) / (cell.acneCount + cell.darkSpotCount);
        }
      });

      // Analyze distribution pattern
      const occupiedCells = result.gridScores.filter(c => c.acneCount > 0 || c.darkSpotCount > 0);
      const totalDetections = allSpots.length;

      // Calculate uniformity (how evenly distributed across cells)
      const detectionsPerCell = occupiedCells.map(c => c.acneCount + c.darkSpotCount);
      const avgPerCell = totalDetections / Math.max(1, occupiedCells.length);
      const variance = detectionsPerCell.reduce((sum, count) => {
        return sum + Math.pow(count - avgPerCell, 2);
      }, 0) / Math.max(1, detectionsPerCell.length);

      // Low variance + many occupied cells = uniform distribution (likely freckles)
      const uniformityScore = 1 - Math.min(1, variance / 10);
      const spreadScore = occupiedCells.length / 16;

      result.uniformDistribution = uniformityScore > 0.6 && spreadScore > 0.3;

      // Check for clustering (concentrated in few cells = likely acne breakout)
      const maxInOneCell = Math.max(...detectionsPerCell, 0);
      result.clusterDetected = maxInOneCell > 5 && spreadScore < 0.3;

      // Freckle indicators:
      // 1. Many small spots spread across multiple regions
      // 2. Uniform size distribution
      // 3. Present in typical freckle areas (cheeks, nose bridge)
      const avgSpotSize = allSpots.reduce((sum, s) => sum + s.size, 0) / allSpots.length;
      const sizeVariance = allSpots.reduce((sum, s) => sum + Math.pow(s.size - avgSpotSize, 2), 0) / allSpots.length;

      // Small spots + low size variance + good spread = likely freckles
      result.isLikelyFreckles = (
        avgSpotSize < 2 &&          // Small spots
        sizeVariance < 1.5 &&       // Uniform sizes
        totalDetections > 5 &&      // Multiple detections
        spreadScore > 0.25 &&       // Spread across face
        !result.clusterDetected     // Not clustered
      );

      // Calculate confidence based on pattern strength
      if (result.isLikelyFreckles) {
        result.confidenceScore = Math.min(0.95, 0.5 + uniformityScore * 0.3 + spreadScore * 0.2);
      } else if (result.clusterDetected) {
        result.confidenceScore = Math.min(0.9, 0.6 + (maxInOneCell / 10) * 0.2);
      } else {
        result.confidenceScore = 0.5;
      }

      console.log('[Grid Analysis] Results:', {
        totalSpots: allSpots.length,
        occupiedCells: occupiedCells.length,
        uniformityScore,
        spreadScore,
        avgSpotSize,
        isLikelyFreckles: result.isLikelyFreckles,
        clusterDetected: result.clusterDetected,
        confidence: result.confidenceScore
      });

      return result;
    }

    renderPins() {
      // DISABLED: Pin markers have been removed because:
      // 1. Face detection positioning is unreliable
      // 2. Markers often appear outside the actual face region
      // 3. This caused confusion for users
      // Instead, users can see their concerns in the detailed list below
      const container = document.getElementById('flashai-vto-pins-container');
      if (container) {
        container.innerHTML = ''; // Clear any existing pins
      }
      console.log('[Pins] Pin markers disabled - using list-based display instead');
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
      const skinContext = this.state.skinContext || {};
      const regionalAnalysis = this.state.regionalAnalysis;

      // Build calibration note if context was provided
      let calibrationNote = '';
      const contextItems = [];

      if (skinContext.freckles && skinContext.freckles !== 'none') {
        contextItems.push(`${skinContext.freckles === 'many' ? 'many' : 'some'} freckles`);
      }
      if (skinContext.conditions && skinContext.conditions.length > 0 && !skinContext.conditions.includes('none')) {
        contextItems.push(skinContext.conditions.join(', '));
      }
      if (skinContext.skinType) {
        contextItems.push(`${skinContext.skinType} skin`);
      }
      if (skinContext.sensitivity && skinContext.sensitivity !== 'no') {
        contextItems.push(`${skinContext.sensitivity} sensitive`);
      }

      if (contextItems.length > 0 || (regionalAnalysis && regionalAnalysis.isLikelyFreckles)) {
        const freckleNote = regionalAnalysis?.isLikelyFreckles
          ? '<br><span style="color:#16a34a;">✓ Pattern analysis suggests natural freckles</span>'
          : '';

        calibrationNote = `
          <div style="margin-bottom:12px;padding:12px;background:linear-gradient(135deg,#ede9fe 0%,#f5f3ff 100%);border-radius:10px;border:1px solid #c4b5fd;">
            <div style="display:flex;align-items:start;gap:8px;">
              <span style="font-size:16px;">🎯</span>
              <div>
                <div style="font-size:11px;font-weight:700;color:#6d28d9;margin-bottom:4px;">PERSONALIZED ANALYSIS</div>
                <p style="font-size:11px;color:#5b21b6;margin:0;line-height:1.4;">
                  Results calibrated for: <strong>${contextItems.join(' • ') || 'your skin profile'}</strong>
                  ${freckleNote}
                </p>
              </div>
            </div>
          </div>
        `;
      }

      if (issues.length === 0) {
        listContainer.innerHTML = calibrationNote + `
          <div class="flashai-vto-no-issues" style="text-align:center;padding:24px;background:#f0fdf4;border-radius:12px;">
            <span style="font-size:32px;">✨</span>
            <p style="font-size:14px;color:#15803d;margin:8px 0 0;">Great news! No significant skin concerns detected.</p>
          </div>
        `;
        return;
      }

      // Severity colors - Red (Significant), Orange (Moderate), Green (Mild)
      const severityColors = {
        concern: { bg: '#fef2f2', border: '#fecaca', num: '#dc2626', badge: '#dc2626', badgeBg: '#fee2e2', highlight: 'rgba(220, 38, 38, 0.3)', bar: '#ef4444' },
        moderate: { bg: '#fffbeb', border: '#fde68a', num: '#d97706', badge: '#d97706', badgeBg: '#fef3c7', highlight: 'rgba(245, 158, 11, 0.3)', bar: '#f59e0b' },
        good: { bg: '#f0fdf4', border: '#bbf7d0', num: '#16a34a', badge: '#16a34a', badgeBg: '#dcfce7', highlight: 'rgba(16, 185, 129, 0.3)', bar: '#22c55e' }
      };

      // Separate concerns from healthy metrics
      const concerns = issues.filter(i => i.isConcern);
      const healthyMetrics = issues.filter(i => !i.isConcern);

      // ========== SAVE ANALYSIS PROMPT ==========
      const savePromptHtml = !this.state.authToken ? `
        <div id="flashai-vto-save-analysis-prompt" style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:12px;border:2px solid #f59e0b;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:48px;height:48px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <span style="font-size:24px;">💾</span>
            </div>
            <div style="flex:1;">
              <h4 style="font-size:14px;font-weight:700;color:#92400e;margin:0 0 4px;">Save Your Analysis</h4>
              <p style="font-size:12px;color:#a16207;margin:0;line-height:1.4;">Track your skin progress over time. Sign in to save this analysis and compare future scans.</p>
            </div>
          </div>
          <button id="flashai-vto-save-analysis-btn" style="width:100%;margin-top:12px;padding:12px;background:#92400e;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
            Sign In to Save & Track Progress
          </button>
        </div>
      ` : `
        <div style="margin-bottom:16px;padding:12px;background:#dcfce7;border-radius:10px;border:1px solid #86efac;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">✅</span>
            <span style="font-size:12px;font-weight:600;color:#166534;">Analysis saved! Track your progress in the Progress tab.</span>
          </div>
        </div>
      `;

      // ========== ALL METRICS WITH CLINICAL GRADES ==========
      // Using internationally recognized dermatology grading scales
      const allMetricsHtml = `
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="font-size:13px;font-weight:700;color:#18181b;margin:0;">📊 Clinical Skin Analysis</h4>
            <span style="font-size:10px;color:#71717a;">${issues.length} metrics assessed</span>
          </div>

          <!-- Clinical Standards Note -->
          <div style="margin-bottom:12px;padding:8px 12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
            <p style="font-size:10px;color:#1e40af;margin:0;line-height:1.4;">
              <strong>🏥 Using Clinical Standards:</strong> IGA (FDA acne scale), Glogau (photoaging), CEA (erythema), POH (dark circles)
            </p>
          </div>

          <!-- Metrics Cards -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${issues.map(issue => {
              const colors = severityColors[issue.severity] || severityColors.moderate;
              const grade = issue.clinicalGrade || { grade: 0, label: 'N/A', scale: 'General', maxGrade: 4 };
              const maxGrade = grade.maxGrade || 4;

              // Build grade dots HTML
              const gradeColor = grade.grade <= 1 ? '#22c55e' : grade.grade <= 2 ? '#f59e0b' : '#ef4444';
              let gradeDots = '';
              for (let i = 0; i <= maxGrade; i++) {
                const dotColor = i <= grade.grade ? gradeColor : '#e5e7eb';
                gradeDots += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:2px;background:' + dotColor + ';"></span>';
              }

              return '<div style="padding:12px;background:' + colors.bg + ';border:1px solid ' + colors.border + ';border-radius:10px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                  '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<span style="font-size:16px;">' + (issue.icon || '•') + '</span>' +
                    '<span style="font-size:13px;font-weight:600;color:#18181b;">' + issue.name + '</span>' +
                    (issue.isConcern ? '<span style="font-size:8px;padding:2px 6px;background:#fef2f2;color:#dc2626;border-radius:4px;font-weight:700;margin-left:4px;">FOCUS</span>' : '') +
                  '</div>' +
                  '<div style="text-align:right;">' +
                    '<div style="font-size:12px;font-weight:700;color:' + colors.num + ';">' + grade.label + '</div>' +
                    '<div style="font-size:9px;color:#6b7280;">' + grade.scale + ' Scale</div>' +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                  '<div style="display:flex;align-items:center;gap:4px;">' +
                    gradeDots +
                    '<span style="font-size:10px;color:#6b7280;margin-left:4px;">Grade ' + grade.grade + '/' + maxGrade + '</span>' +
                  '</div>' +
                  '<div style="font-size:10px;color:#71717a;max-width:50%;text-align:right;">' + (grade.description || '') + '</div>' +
                '</div>' +
              '</div>';
            }).join('')}
          </div>

          <!-- Clinical Note -->
          <div style="margin-top:12px;padding:10px 12px;background:#fefce8;border-radius:8px;border:1px solid #fde047;">
            <p style="font-size:10px;color:#854d0e;margin:0;line-height:1.4;">
              <strong>📋 Note:</strong> Grades follow clinical dermatology standards. Grade 0-1 = Healthy, Grade 2 = Monitor, Grade 3-4 = Consult a dermatologist for personalized advice.
            </p>
          </div>
        </div>
      `;

      // ========== AREAS OF FOCUS (CONCERNS) - ACCORDION STYLE ==========
      let concernsHtml = '';
      if (concerns.length > 0) {
        concernsHtml = `
          <div style="margin-bottom:16px;">
            <h4 style="font-size:13px;font-weight:700;color:#dc2626;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
              <span>🎯</span> Areas of Focus - Detailed Recommendations (${concerns.length})
            </h4>
            ${concerns.map((issue, idx) => {
              const index = issues.indexOf(issue); // Get original index for accordion
              const colors = severityColors[issue.severity] || severityColors.moderate;
              const grade = issue.clinicalGrade || { grade: 0, label: 'N/A', scale: 'General' };
              return `
              <div class="flashai-vto-accordion-item" data-index="${index}" style="margin-bottom:8px;">
                <!-- Header (clickable) -->
                <div class="flashai-vto-accordion-header ${issue.severity}" data-index="${index}"
                     style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${colors.bg};border:2px solid ${colors.border};border-radius:12px;cursor:pointer;transition:all 0.2s;">
                  <span class="flashai-vto-issue-num" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${colors.num};color:#fff;font-size:13px;font-weight:700;flex-shrink:0;">${idx + 1}</span>
                  <div class="flashai-vto-issue-info" style="flex:1;min-width:0;">
                    <span class="flashai-vto-issue-name" style="display:block;font-size:14px;font-weight:600;color:#18181b;">${issue.name}</span>
                    <span class="flashai-vto-issue-region" style="display:block;font-size:12px;color:#71717a;margin-top:2px;">${issue.region} • ${grade.scale} Grade ${grade.grade}</span>
                  </div>
                  <div class="flashai-vto-issue-badge" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${colors.badgeBg};color:${colors.badge};text-transform:uppercase;letter-spacing:0.5px;">${grade.label}</div>
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
            }).join('')}
          </div>
        `;
      }

      // ========== HEALTHY METRICS SUMMARY ==========
      let healthyHtml = '';
      if (healthyMetrics.length > 0) {
        healthyHtml = `
          <div style="margin-bottom:16px;">
            <h4 style="font-size:13px;font-weight:700;color:#16a34a;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
              <span>✨</span> Looking Good (${healthyMetrics.length})
            </h4>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
              ${healthyMetrics.map(issue => {
                const colors = severityColors[issue.severity] || severityColors.good;
                return `
                  <div style="padding:12px;background:${colors.bg};border:1px solid ${colors.border};border-radius:10px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                      <span style="font-size:14px;">${issue.icon || '•'}</span>
                      <span style="font-size:11px;font-weight:600;color:#18181b;">${issue.name}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                      <div style="flex:1;height:4px;background:#d1fae5;border-radius:2px;margin-right:8px;">
                        <div style="height:100%;width:${issue.score}%;background:#22c55e;border-radius:2px;"></div>
                      </div>
                      <span style="font-size:12px;font-weight:700;color:#16a34a;">${issue.score}%</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      // Combine all sections
      listContainer.innerHTML = calibrationNote + savePromptHtml + allMetricsHtml + concernsHtml + healthyHtml;

      // Add click handler for Save Analysis button
      const saveBtn = document.getElementById('flashai-vto-save-analysis-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.showAuthModal();
        });
      }

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
            if (score < 40) return 'Your skin looks generally clear. Minor spots may be temporary.';
            if (score < 70) return `Some blemishes detected (${count > 0 ? count : 'a few'}). This is very common and manageable.`;
            return `Multiple blemishes visible (${count > 0 ? count : 'several'}). A consistent skincare routine can help.`;
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
            if (score < 40) return 'Your skin tone appears fairly even. Natural variations like freckles are normal.';
            if (score < 70) return `Some uneven tone detected${spots > 0 ? ` (${spots} spots)` : ''}. This is common and often from sun exposure.`;
            return `Uneven pigmentation visible${spots > 0 ? ` with ${spots} darker areas` : ''}. Brightening products and SPF can help over time.`;
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
            if (score < 45) return 'Your skin tone appears balanced. Some natural color variation is normal.';
            if (score < 70) return 'Mild redness visible, which can be natural or from recent activity. May indicate slight sensitivity.';
            return 'Noticeable redness detected. This could be temporary (heat, exercise) or indicate sensitivity. Calming products may help.';
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

      // CALIBRATED: Higher thresholds and softer language
      // Only recommend professional consultation for clearly severe cases
      const concerns = [];

      // Very severe acne only (raised from 70 to 85)
      if ((analysis.acne_score || 0) > 85 && (analysis.pimple_count || 0) > 15) {
        concerns.push('persistent acne that may benefit from professional guidance');
      }

      // Clear rosacea indicators only (raised from 65 to 80)
      if (analysis.rosacea_indicators && (analysis.redness_score || 0) > 80) {
        concerns.push('persistent redness patterns that a dermatologist could assess');
      }

      // Confirmed melasma only (raised from 70 to 85)
      if (analysis.melasma_detected && (analysis.pigmentation_score || 0) > 85) {
        concerns.push('pigmentation patterns that may benefit from professional treatments');
      }

      // Very low skin health score (raised threshold)
      if ((analysis.skin_score || 50) < 20) {
        concerns.push('multiple areas that could benefit from professional assessment');
      }

      // Severe dehydration with confirmed dry patches
      if (analysis.dry_patches_detected && (analysis.hydration_score || 65) < 20) {
        concerns.push('signs of skin barrier concerns');
      }

      // Deep wrinkles with clear sun damage (raised thresholds)
      if ((analysis.deep_wrinkles_count || 0) > 8 && (analysis.sun_damage_score || 0) > 75) {
        concerns.push('signs of sun exposure that a professional could assess');
      }

      if (concerns.length > 0) {
        container.style.display = 'block';
        textEl.innerHTML = `
          Our analysis suggests <strong>${concerns.join(', ')}</strong>.
          While our product recommendations can be helpful, you may want to consider consulting a dermatologist
          for personalized advice.
          <br><br>
          <em style="font-size:11px;color:#991b1b;">Note: This is an AI-powered analysis for skincare guidance only, not a medical diagnosis. Results may vary.</em>
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
