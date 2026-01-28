/**
 * Flash AI Virtual Try-On & Face Scan Widget
 * Version: 1.2.0 (Face Scan with 3 angles)
 *
 * Embeddable widget for virtual try-on and face scan functionality
 *
 * Usage:
 * <script src="https://your-domain.com/api/vto/YOUR_STORE_ID.js"></script>
 */

(function() {
  'use strict';

  // Version check for debugging
  console.log('[Flash AI Widget] Version 1.2.0 - Face Scan with 3 angles');

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
              <button id="flashai-vto-select-tryon" class="flashai-vto-selection-card">
                <div class="flashai-vto-selection-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <h3>Virtual Try-On</h3>
                <p>Visualize clothes on your body with AR</p>
              </button>

              <button id="flashai-vto-select-facescan" class="flashai-vto-selection-card" style="background: linear-gradient(135deg, ${this.config.primaryColor}15, ${this.config.primaryColor}25);">
                <div class="flashai-vto-selection-icon" style="color: ${this.config.primaryColor};">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="9" cy="9" r="1" fill="currentColor"></circle>
                    <circle cx="15" cy="9" r="1" fill="currentColor"></circle>
                    <path d="M8 15s1.5 2 4 2 4-2 4-2"></path>
                  </svg>
                </div>
                <h3>Find My Shade</h3>
                <p>AI skin analysis & product recommendations</p>
              </button>
            </div>
          </div>

          <!-- Step: Sign In (before face scan) -->
          <div id="flashai-vto-step-signin" class="flashai-vto-step">
            <div class="flashai-vto-header">
              <h2>Sign In for Best Experience</h2>
              <p>Track your skin journey & see past scans</p>
            </div>

            <div class="flashai-vto-signin-content">
              <!-- User header (shown when logged in) -->
              <div class="flashai-vto-user-header" id="flashai-vto-user-header" style="display: none;">
                <div class="flashai-vto-user-avatar">👤</div>
                <div class="flashai-vto-user-info">
                  <span class="flashai-vto-user-name" id="flashai-vto-user-name">Welcome!</span>
                  <span class="flashai-vto-user-email" id="flashai-vto-user-email"></span>
                </div>
              </div>

              <!-- Scan History (shown when logged in) -->
              <div class="flashai-vto-scan-history" id="flashai-vto-scan-history" style="display: none;">
                <h3>Your Previous Scans</h3>
                <div class="flashai-vto-history-list" id="flashai-vto-history-list">
                  <div class="flashai-vto-loading">Loading scan history...</div>
                </div>
                <button id="flashai-vto-new-scan-btn" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}; margin-top: 16px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  Take New Scan
                </button>
              </div>

              <!-- Sign In Options (shown when not logged in) -->
              <div class="flashai-vto-signin-options" id="flashai-vto-signin-options">
                <div class="flashai-vto-signin-benefits">
                  <div class="flashai-vto-benefit-item">
                    <span class="flashai-vto-benefit-check">✓</span>
                    <span>Track skin improvements over time</span>
                  </div>
                  <div class="flashai-vto-benefit-item">
                    <span class="flashai-vto-benefit-check">✓</span>
                    <span>Access your previous scan results</span>
                  </div>
                  <div class="flashai-vto-benefit-item">
                    <span class="flashai-vto-benefit-check">✓</span>
                    <span>Get personalized routine recommendations</span>
                  </div>
                </div>

                <div class="flashai-vto-signin-actions">
                  <button id="flashai-vto-signin-email-btn" class="flashai-vto-auth-btn flashai-vto-auth-email">
                    <span class="flashai-vto-auth-icon">✉️</span>
                    Sign In with Email
                  </button>
                  <button id="flashai-vto-signin-google-btn" class="flashai-vto-auth-btn flashai-vto-auth-google">
                    <svg class="flashai-vto-google-icon" viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign In with Google
                  </button>
                </div>

                <div class="flashai-vto-signin-divider">
                  <span>or</span>
                </div>

                <button id="flashai-vto-guest-scan-btn" class="flashai-vto-btn-secondary">
                  Continue as Guest
                </button>
                <p class="flashai-vto-guest-note">Guest scans won't be saved to your history</p>
              </div>
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
              <p id="flashai-vto-face-angle-instruction">Take 3 photos: Front, Left Profile, Right Profile</p>
            </div>

            <div class="flashai-vto-camera-container">
              <video id="flashai-vto-face-camera" autoplay playsinline></video>
              <div class="flashai-vto-face-angle-indicator" id="flashai-vto-face-angle-indicator">
                📸 Photo <span id="flashai-vto-face-photo-count">1</span> of 3: <span id="flashai-vto-current-angle">Front View</span>
              </div>
            </div>

            <div class="flashai-vto-face-photos-preview" id="flashai-vto-face-photos"></div>

            <div class="flashai-vto-actions">
              <button id="flashai-vto-face-capture" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Capture Front View
              </button>
              <button id="flashai-vto-face-analyze" class="flashai-vto-btn-success" style="display: none;">
                Analyze Skin
              </button>
            </div>

            <div class="flashai-vto-instructions">
              <h4>For best results:</h4>
              <ul>
                <li>📷 <strong>Front View:</strong> Face the camera directly</li>
                <li>📷 <strong>Left Profile:</strong> Turn your head 45° to the left</li>
                <li>📷 <strong>Right Profile:</strong> Turn your head 45° to the right</li>
                <li>💡 Good lighting is essential for accurate analysis</li>
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

          <!-- Face Scan Step 3: Results -->
          <div id="flashai-vto-step-face-results" class="flashai-vto-step">
            <div class="flashai-vto-face-results-content">
              <!-- Tab Navigation -->
              <div class="flashai-vto-tabs">
                <button class="flashai-vto-tab active" data-tab="results">
                  <span class="flashai-vto-tab-icon">📊</span>
                  <span>Results</span>
                </button>
                <button class="flashai-vto-tab" data-tab="routine">
                  <span class="flashai-vto-tab-icon">🧴</span>
                  <span>My Routine</span>
                </button>
                <button class="flashai-vto-tab" data-tab="progress">
                  <span class="flashai-vto-tab-icon">📈</span>
                  <span>Track</span>
                </button>
              </div>

              <!-- Tab Content: Results -->
              <div class="flashai-vto-tab-content active" data-tab-content="results">
              <div class="flashai-vto-results-header">
                <h2>Your Skin Analysis</h2>
                <div class="flashai-vto-skin-score-circle">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#e0e0e0" stroke-width="12"></circle>
                    <circle id="flashai-vto-score-circle" cx="60" cy="60" r="54" fill="none" stroke="${this.config.primaryColor}" stroke-width="12" stroke-dasharray="339.3" stroke-dashoffset="339.3" transform="rotate(-90 60 60)"></circle>
                  </svg>
                  <div class="flashai-vto-score-text">
                    <span id="flashai-vto-skin-score">--</span>
                    <span class="flashai-vto-score-label">Skin Score</span>
                  </div>
                </div>
              </div>

              <div class="flashai-vto-skin-metrics">
                <div class="flashai-vto-metric-card" id="flashai-vto-metric-pigmentation">
                  <div class="flashai-vto-metric-icon">☀️</div>
                  <div class="flashai-vto-metric-content">
                    <h4>Pigmentation</h4>
                    <div class="flashai-vto-metric-bar">
                      <div class="flashai-vto-metric-fill" data-metric="pigmentation"></div>
                    </div>
                    <p class="flashai-vto-metric-value">--</p>
                  </div>
                </div>

                <div class="flashai-vto-metric-card" id="flashai-vto-metric-acne">
                  <div class="flashai-vto-metric-icon">🎯</div>
                  <div class="flashai-vto-metric-content">
                    <h4>Acne & Blemishes</h4>
                    <div class="flashai-vto-metric-bar">
                      <div class="flashai-vto-metric-fill" data-metric="acne"></div>
                    </div>
                    <p class="flashai-vto-metric-value">--</p>
                  </div>
                </div>

                <div class="flashai-vto-metric-card" id="flashai-vto-metric-wrinkles">
                  <div class="flashai-vto-metric-icon">✨</div>
                  <div class="flashai-vto-metric-content">
                    <h4>Wrinkles & Lines</h4>
                    <div class="flashai-vto-metric-bar">
                      <div class="flashai-vto-metric-fill" data-metric="wrinkles"></div>
                    </div>
                    <p class="flashai-vto-metric-value">--</p>
                  </div>
                </div>

                <div class="flashai-vto-metric-card" id="flashai-vto-metric-texture">
                  <div class="flashai-vto-metric-icon">💎</div>
                  <div class="flashai-vto-metric-content">
                    <h4>Skin Texture</h4>
                    <div class="flashai-vto-metric-bar">
                      <div class="flashai-vto-metric-fill" data-metric="texture"></div>
                    </div>
                    <p class="flashai-vto-metric-value">--</p>
                  </div>
                </div>

                <div class="flashai-vto-metric-card" id="flashai-vto-metric-redness">
                  <div class="flashai-vto-metric-icon">🌸</div>
                  <div class="flashai-vto-metric-content">
                    <h4>Redness</h4>
                    <div class="flashai-vto-metric-bar">
                      <div class="flashai-vto-metric-fill" data-metric="redness"></div>
                    </div>
                    <p class="flashai-vto-metric-value">--</p>
                  </div>
                </div>

                <div class="flashai-vto-metric-card" id="flashai-vto-metric-hydration">
                  <div class="flashai-vto-metric-icon">💧</div>
                  <div class="flashai-vto-metric-content">
                    <h4>Hydration</h4>
                    <div class="flashai-vto-metric-bar">
                      <div class="flashai-vto-metric-fill" data-metric="hydration"></div>
                    </div>
                    <p class="flashai-vto-metric-value">--</p>
                  </div>
                </div>
              </div>

              <div class="flashai-vto-skin-details">
                <div class="flashai-vto-detail-row">
                  <span>Skin Tone:</span>
                  <strong id="flashai-vto-skin-tone">--</strong>
                </div>
                <div class="flashai-vto-detail-row">
                  <span>Undertone:</span>
                  <strong id="flashai-vto-skin-undertone">--</strong>
                </div>
                <div class="flashai-vto-detail-row">
                  <span>Skin Age:</span>
                  <strong id="flashai-vto-skin-age">--</strong>
                </div>
                <div class="flashai-vto-detail-row">
                  <span>Hydration Level:</span>
                  <strong id="flashai-vto-hydration-level">--</strong>
                </div>
              </div>

              <div class="flashai-vto-recommendations-section">
                <h3>Recommended For You</h3>
                <p class="flashai-vto-recommendations-subtitle">Products matched to your skin concerns</p>

                <div class="flashai-vto-recommendations-carousel" id="flashai-vto-recommendations">
                  <div class="flashai-vto-recommendations-loading">Finding perfect products...</div>
                </div>
              </div>

              <div class="flashai-vto-actions">
                <button id="flashai-vto-new-scan" class="flashai-vto-btn-secondary">
                  New Scan
                </button>
                <button id="flashai-vto-shop-recommended" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                  Shop Recommendations
                </button>
              </div>
              </div><!-- End Results Tab Content -->

              <!-- Tab Content: My Routine (Pre-Login) -->
              <div class="flashai-vto-tab-content" data-tab-content="routine">
                <div class="flashai-vto-routine-promo" id="flashai-vto-routine-promo">
                  <div class="flashai-vto-routine-header">
                    <div class="flashai-vto-routine-icon">🧴✨</div>
                    <h2>Your Personalized Routine</h2>
                    <p class="flashai-vto-routine-subtitle">Based on your unique skin analysis</p>
                  </div>

                  <div class="flashai-vto-routine-preview">
                    <div class="flashai-vto-routine-preview-card">
                      <div class="flashai-vto-routine-time">
                        <span class="flashai-vto-time-icon">☀️</span>
                        <span>Morning Routine</span>
                      </div>
                      <div class="flashai-vto-routine-steps-preview" id="flashai-vto-am-preview">
                        <div class="flashai-vto-step-preview">Cleanser</div>
                        <div class="flashai-vto-step-preview">Serum</div>
                        <div class="flashai-vto-step-preview">Moisturizer</div>
                        <div class="flashai-vto-step-preview">SPF</div>
                      </div>
                    </div>
                    <div class="flashai-vto-routine-preview-card">
                      <div class="flashai-vto-routine-time">
                        <span class="flashai-vto-time-icon">🌙</span>
                        <span>Evening Routine</span>
                      </div>
                      <div class="flashai-vto-routine-steps-preview" id="flashai-vto-pm-preview">
                        <div class="flashai-vto-step-preview">Double Cleanse</div>
                        <div class="flashai-vto-step-preview">Treatment</div>
                        <div class="flashai-vto-step-preview">Eye Cream</div>
                        <div class="flashai-vto-step-preview">Night Cream</div>
                      </div>
                    </div>
                  </div>

                  <div class="flashai-vto-routine-focus" id="flashai-vto-routine-focus">
                    <span class="flashai-vto-focus-label">Targeting:</span>
                    <span class="flashai-vto-focus-concerns">Your top skin concerns</span>
                  </div>

                  <div class="flashai-vto-routine-benefits">
                    <div class="flashai-vto-benefit">
                      <span class="flashai-vto-benefit-icon">✓</span>
                      <span>Products matched to your skin type</span>
                    </div>
                    <div class="flashai-vto-benefit">
                      <span class="flashai-vto-benefit-icon">✓</span>
                      <span>Daily reminders to stay consistent</span>
                    </div>
                    <div class="flashai-vto-benefit">
                      <span class="flashai-vto-benefit-icon">✓</span>
                      <span>Track progress over time</span>
                    </div>
                    <div class="flashai-vto-benefit">
                      <span class="flashai-vto-benefit-icon">✓</span>
                      <span>Adjust routine as your skin changes</span>
                    </div>
                  </div>

                  <div class="flashai-vto-auth-section">
                    <p class="flashai-vto-auth-prompt">Create a free account to unlock your personalized routine</p>
                    <button id="flashai-vto-auth-email" class="flashai-vto-auth-btn flashai-vto-auth-email">
                      <span class="flashai-vto-auth-icon">✉️</span>
                      Continue with Email
                    </button>
                    <button id="flashai-vto-auth-google" class="flashai-vto-auth-btn flashai-vto-auth-google">
                      <svg class="flashai-vto-google-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </button>
                    <p class="flashai-vto-auth-note">Your data stays private. We never share your skin analysis.</p>
                  </div>
                </div>

                <!-- Logged-in Routine View (hidden by default) -->
                <div class="flashai-vto-routine-full" id="flashai-vto-routine-full" style="display: none;">
                  <div class="flashai-vto-routine-loading" id="flashai-vto-routine-loading">
                    <div class="flashai-vto-spinner"></div>
                    <p>Building your personalized routine...</p>
                  </div>
                  <div id="flashai-vto-routine-content"></div>
                </div>
              </div><!-- End Routine Tab Content -->

              <!-- Tab Content: Track Progress -->
              <div class="flashai-vto-tab-content" data-tab-content="progress">
                <div class="flashai-vto-progress-promo">
                  <div class="flashai-vto-progress-header">
                    <div class="flashai-vto-progress-icon">📈</div>
                    <h2>Track Your Skin Journey</h2>
                    <p class="flashai-vto-progress-subtitle">See how your skin improves over time</p>
                  </div>

                  <div class="flashai-vto-progress-preview">
                    <div class="flashai-vto-timeline-preview">
                      <div class="flashai-vto-timeline-item">
                        <div class="flashai-vto-timeline-dot current"></div>
                        <div class="flashai-vto-timeline-content">
                          <strong>Today</strong>
                          <span>First scan complete</span>
                        </div>
                      </div>
                      <div class="flashai-vto-timeline-item">
                        <div class="flashai-vto-timeline-dot"></div>
                        <div class="flashai-vto-timeline-content">
                          <strong>Week 2</strong>
                          <span>Early improvements visible</span>
                        </div>
                      </div>
                      <div class="flashai-vto-timeline-item">
                        <div class="flashai-vto-timeline-dot"></div>
                        <div class="flashai-vto-timeline-content">
                          <strong>Month 1</strong>
                          <span>Noticeable skin changes</span>
                        </div>
                      </div>
                      <div class="flashai-vto-timeline-item">
                        <div class="flashai-vto-timeline-dot"></div>
                        <div class="flashai-vto-timeline-content">
                          <strong>Month 3</strong>
                          <span>Transformed skin</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flashai-vto-progress-features">
                    <div class="flashai-vto-feature-card">
                      <span class="flashai-vto-feature-icon">📸</span>
                      <h4>Photo Comparisons</h4>
                      <p>Side-by-side before & after</p>
                    </div>
                    <div class="flashai-vto-feature-card">
                      <span class="flashai-vto-feature-icon">📊</span>
                      <h4>Score Trends</h4>
                      <p>Watch your scores improve</p>
                    </div>
                    <div class="flashai-vto-feature-card">
                      <span class="flashai-vto-feature-icon">🎯</span>
                      <h4>Goal Tracking</h4>
                      <p>Set and achieve skin goals</p>
                    </div>
                  </div>

                  <div class="flashai-vto-progress-cta">
                    <p>Start tracking your progress</p>
                    <button id="flashai-vto-progress-auth" class="flashai-vto-btn-primary" style="background-color: ${this.config.primaryColor}">
                      Create Free Account
                    </button>
                  </div>
                </div>
              </div><!-- End Progress Tab Content -->

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

      // Add user header to modal (shows logged-in user info)
      const content = modal.querySelector('.flashai-vto-content');
      const userBar = document.createElement('div');
      userBar.id = 'flashai-vto-modal-user-bar';
      userBar.className = 'flashai-vto-modal-user-bar';
      userBar.style.display = 'none';
      userBar.innerHTML = `
        <div class="flashai-vto-modal-user-info">
          <span class="flashai-vto-modal-user-avatar">👤</span>
          <span class="flashai-vto-modal-user-name"></span>
        </div>
        <button class="flashai-vto-logout-btn" title="Sign Out">Sign Out</button>
      `;
      content.insertBefore(userBar, content.querySelector('.flashai-vto-close'));

      // Attach event listeners
      this.attachModalEvents();

      // Check if user is already logged in
      this.checkExistingLogin();
    }

    checkExistingLogin() {
      const savedUser = localStorage.getItem('flashai_user');
      const savedToken = localStorage.getItem('flashai_token');

      if (savedUser && savedToken) {
        try {
          this.state.user = JSON.parse(savedUser);
          this.updateUserDisplay();
        } catch (e) {
          console.error('Error parsing saved user:', e);
          localStorage.removeItem('flashai_user');
          localStorage.removeItem('flashai_token');
        }
      }
    }

    updateUserDisplay() {
      const user = this.state.user;
      if (!user) return;

      // Update modal user bar
      const userBar = document.getElementById('flashai-vto-modal-user-bar');
      if (userBar) {
        userBar.style.display = 'flex';
        const nameEl = userBar.querySelector('.flashai-vto-modal-user-name');
        if (nameEl) {
          nameEl.textContent = user.display_name || user.email?.split('@')[0] || 'User';
        }
      }

      // Update sign-in step user header
      const userHeader = document.getElementById('flashai-vto-user-header');
      const signinOptions = document.getElementById('flashai-vto-signin-options');
      const scanHistory = document.getElementById('flashai-vto-scan-history');

      if (userHeader) {
        userHeader.style.display = 'flex';
        const nameEl = document.getElementById('flashai-vto-user-name');
        const emailEl = document.getElementById('flashai-vto-user-email');
        if (nameEl) nameEl.textContent = `Welcome, ${user.display_name || user.email?.split('@')[0] || 'User'}!`;
        if (emailEl) emailEl.textContent = user.email || '';
      }

      if (signinOptions) signinOptions.style.display = 'none';
      if (scanHistory) {
        scanHistory.style.display = 'block';
        this.loadScanHistory();
      }
    }

    async loadScanHistory() {
      const historyList = document.getElementById('flashai-vto-history-list');
      if (!historyList) return;

      try {
        const token = localStorage.getItem('flashai_token');
        const faceScanBaseUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/face-scan');

        const response = await fetch(`${faceScanBaseUrl}/history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-Key': this.config.apiKey
          }
        });

        const data = await response.json();

        if (data.success && data.scans && data.scans.length > 0) {
          historyList.innerHTML = data.scans.slice(0, 5).map(scan => `
            <div class="flashai-vto-history-item" data-scan-id="${scan.id}">
              <div class="flashai-vto-history-date">${new Date(scan.created_at).toLocaleDateString()}</div>
              <div class="flashai-vto-history-score">
                <span class="flashai-vto-history-score-value">${scan.skin_score || '--'}</span>
                <span class="flashai-vto-history-score-label">Skin Score</span>
              </div>
              <button class="flashai-vto-history-view-btn">View</button>
            </div>
          `).join('');

          // Add click handlers
          historyList.querySelectorAll('.flashai-vto-history-item').forEach(item => {
            item.querySelector('.flashai-vto-history-view-btn').addEventListener('click', () => {
              this.viewHistoricalScan(item.dataset.scanId);
            });
          });
        } else {
          historyList.innerHTML = `
            <div class="flashai-vto-no-history">
              <p>No previous scans found</p>
              <p class="flashai-vto-no-history-hint">Take your first scan to start tracking your skin journey!</p>
            </div>
          `;
        }
      } catch (error) {
        console.error('Load scan history error:', error);
        historyList.innerHTML = '<p class="flashai-vto-error">Failed to load scan history</p>';
      }
    }

    async viewHistoricalScan(scanId) {
      try {
        const token = localStorage.getItem('flashai_token');
        const faceScanBaseUrl = this.config.apiBaseUrl.replace('/api/vto', '/api/face-scan');

        const response = await fetch(`${faceScanBaseUrl}/${scanId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-Key': this.config.apiKey
          }
        });

        const data = await response.json();

        if (data.success && data.data) {
          this.state.faceScanId = scanId;
          this.displayFaceResults(data.data);
        }
      } catch (error) {
        console.error('View historical scan error:', error);
        alert('Failed to load scan details');
      }
    }

    handleLogout() {
      localStorage.removeItem('flashai_user');
      localStorage.removeItem('flashai_token');
      this.state.user = null;

      // Hide user bar
      const userBar = document.getElementById('flashai-vto-modal-user-bar');
      if (userBar) userBar.style.display = 'none';

      // Reset sign-in step
      const userHeader = document.getElementById('flashai-vto-user-header');
      const signinOptions = document.getElementById('flashai-vto-signin-options');
      const scanHistory = document.getElementById('flashai-vto-scan-history');

      if (userHeader) userHeader.style.display = 'none';
      if (signinOptions) signinOptions.style.display = 'block';
      if (scanHistory) scanHistory.style.display = 'none';

      // Show routine promo instead of logged-in view
      this.showLoggedOutRoutine();

      this.trackEvent('user_logged_out');
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
        // Show sign-in step first
        this.showStep('signin');
      });

      // Sign-in step buttons
      const signinEmailBtn = modal.querySelector('#flashai-vto-signin-email-btn');
      if (signinEmailBtn) {
        signinEmailBtn.addEventListener('click', () => {
          this.showSignInModal('email');
        });
      }

      const signinGoogleBtn = modal.querySelector('#flashai-vto-signin-google-btn');
      if (signinGoogleBtn) {
        signinGoogleBtn.addEventListener('click', () => {
          this.handleGoogleAuth();
        });
      }

      const guestScanBtn = modal.querySelector('#flashai-vto-guest-scan-btn');
      if (guestScanBtn) {
        guestScanBtn.addEventListener('click', () => {
          this.showStep('facescan');
        });
      }

      const newScanBtn = modal.querySelector('#flashai-vto-new-scan-btn');
      if (newScanBtn) {
        newScanBtn.addEventListener('click', () => {
          this.showStep('facescan');
        });
      }

      // Logout button
      const logoutBtn = modal.querySelector('.flashai-vto-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          this.handleLogout();
        });
      }

      // Face scan buttons
      modal.querySelector('#flashai-vto-face-capture').addEventListener('click', () => {
        this.captureFacePhoto();
      });

      modal.querySelector('#flashai-vto-face-analyze').addEventListener('click', () => {
        this.analyzeFaceScan();
      });

      // Face scan result buttons
      modal.querySelector('#flashai-vto-new-scan').addEventListener('click', () => {
        this.showStep('selection');
        this.stopFaceCamera();
      });

      modal.querySelector('#flashai-vto-shop-recommended').addEventListener('click', () => {
        this.shopRecommendedProducts();
      });

      // Tab navigation
      modal.querySelectorAll('.flashai-vto-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          this.switchTab(tabName);
        });
      });

      // Auth buttons
      const authEmailBtn = modal.querySelector('#flashai-vto-auth-email');
      if (authEmailBtn) {
        authEmailBtn.addEventListener('click', () => {
          this.showAuthModal('email');
        });
      }

      const authGoogleBtn = modal.querySelector('#flashai-vto-auth-google');
      if (authGoogleBtn) {
        authGoogleBtn.addEventListener('click', () => {
          this.handleGoogleAuth();
        });
      }

      const progressAuthBtn = modal.querySelector('#flashai-vto-progress-auth');
      if (progressAuthBtn) {
        progressAuthBtn.addEventListener('click', () => {
          this.switchTab('routine');
          setTimeout(() => this.showAuthModal('email'), 300);
        });
      }
    }

    // ==========================================================================
    // Tab Switching
    // ==========================================================================

    switchTab(tabName) {
      const modal = this.elements.modal;

      // Update tab buttons
      modal.querySelectorAll('.flashai-vto-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });

      // Update tab content
      modal.querySelectorAll('.flashai-vto-tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tabContent === tabName);
      });

      // Track tab switch
      this.trackEvent('tab_switched', { tab: tabName });

      // If switching to routine tab and user is logged in, load routine
      if (tabName === 'routine' && this.state.user) {
        this.loadUserRoutine();
      }

      // Update routine focus based on scan results
      if (tabName === 'routine' && this.state.lastScanAnalysis) {
        this.updateRoutineFocus(this.state.lastScanAnalysis);
      }
    }

    updateRoutineFocus(analysis) {
      const focusElement = document.getElementById('flashai-vto-routine-focus');
      if (!focusElement || !analysis) return;

      // Determine top concerns based on scores
      const concerns = [];
      if (analysis.pigmentation_score > 40) concerns.push('Pigmentation');
      if (analysis.acne_score > 30) concerns.push('Acne');
      if (analysis.redness_score > 30) concerns.push('Redness');
      if (analysis.wrinkle_score > 40) concerns.push('Anti-Aging');
      if (analysis.hydration_score < 50) concerns.push('Hydration');

      if (concerns.length === 0) concerns.push('Overall Skin Health');

      const focusConcerns = focusElement.querySelector('.flashai-vto-focus-concerns');
      if (focusConcerns) {
        focusConcerns.textContent = concerns.slice(0, 3).join(', ');
      }
    }

    // ==========================================================================
    // Authentication
    // ==========================================================================

    showAuthModal(type) {
      // Create auth modal
      const authOverlay = document.createElement('div');
      authOverlay.className = 'flashai-vto-auth-overlay';
      authOverlay.innerHTML = `
        <div class="flashai-vto-auth-modal">
          <button class="flashai-vto-auth-close">&times;</button>
          <div class="flashai-vto-auth-header">
            <h3>Create Your Account</h3>
            <p>Get your personalized skincare routine</p>
          </div>
          <form id="flashai-vto-auth-form" class="flashai-vto-auth-form">
            <div class="flashai-vto-form-group">
              <label>Email</label>
              <input type="email" id="flashai-vto-auth-email-input" placeholder="your@email.com" required>
            </div>
            <div class="flashai-vto-form-group">
              <label>Name (optional)</label>
              <input type="text" id="flashai-vto-auth-name-input" placeholder="Your name">
            </div>
            <button type="submit" class="flashai-vto-auth-submit" style="background-color: ${this.config.primaryColor}">
              Continue
            </button>
          </form>
          <p class="flashai-vto-auth-terms">
            By continuing, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
          </p>
        </div>
      `;

      this.elements.modal.appendChild(authOverlay);

      // Close button
      authOverlay.querySelector('.flashai-vto-auth-close').addEventListener('click', () => {
        authOverlay.remove();
      });

      // Overlay click
      authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) authOverlay.remove();
      });

      // Form submit
      authOverlay.querySelector('#flashai-vto-auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('flashai-vto-auth-email-input').value;
        const name = document.getElementById('flashai-vto-auth-name-input').value;
        await this.registerUser(email, name, authOverlay);
      });
    }

    async registerUser(email, name, authOverlay) {
      const submitBtn = authOverlay.querySelector('.flashai-vto-auth-submit');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Creating account...';
      submitBtn.disabled = true;

      try {
        const response = await fetch(this.config.apiBaseUrl.replace('/api/vto', '/api/widget/users'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({
            email,
            name,
            store_id: this.config.storeId,
            visitor_id: this.state.visitorId,
            scan_id: this.state.faceScanId
          })
        });

        const data = await response.json();

        if (data.success) {
          // Store user info
          this.state.user = data.user;
          localStorage.setItem('flashai_user', JSON.stringify(data.user));
          localStorage.setItem('flashai_token', data.token);

          // Remove auth overlay
          authOverlay.remove();

          // Show logged-in routine view
          this.showLoggedInRoutine();

          // Track registration
          this.trackEvent('user_registered', { method: 'email' });
        } else {
          throw new Error(data.error || 'Registration failed');
        }
      } catch (error) {
        console.error('Registration error:', error);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        alert('Registration failed. Please try again.');
      }
    }

    handleGoogleAuth() {
      // TODO: Implement Google OAuth
      alert('Google sign-in coming soon! Please use email for now.');
    }

    showLoggedInRoutine() {
      // Hide promo, show full routine view
      const promo = document.getElementById('flashai-vto-routine-promo');
      const full = document.getElementById('flashai-vto-routine-full');

      if (promo) promo.style.display = 'none';
      if (full) {
        full.style.display = 'block';
        this.loadUserRoutine();
      }
    }

    async loadUserRoutine() {
      const content = document.getElementById('flashai-vto-routine-content');
      const loading = document.getElementById('flashai-vto-routine-loading');

      if (!content) return;

      try {
        const token = localStorage.getItem('flashai_token');
        if (!token) {
          this.showLoggedOutRoutine();
          return;
        }

        const response = await fetch(this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-API-Key': this.config.apiKey
          }
        });

        const data = await response.json();

        if (loading) loading.style.display = 'none';

        if (data.success && data.routines && data.routines.length > 0) {
          this.displayRoutine(data.routines, content);
        } else {
          // No routine yet, show questionnaire prompt
          this.showQuestionnairePrompt(content);
        }
      } catch (error) {
        console.error('Load routine error:', error);
        if (loading) loading.style.display = 'none';
        content.innerHTML = '<p class="flashai-vto-error">Failed to load routine. Please try again.</p>';
      }
    }

    showQuestionnairePrompt(content) {
      content.innerHTML = `
        <div class="flashai-vto-questionnaire-prompt">
          <div class="flashai-vto-prompt-icon">📋</div>
          <h3>Let's personalize your routine!</h3>
          <p>Answer a few quick questions so we can create the perfect routine for your skin.</p>
          <button class="flashai-vto-btn-primary flashai-vto-start-questionnaire" style="background-color: ${this.config.primaryColor}">
            Start Questionnaire (2 min)
          </button>
        </div>
      `;

      content.querySelector('.flashai-vto-start-questionnaire').addEventListener('click', () => {
        this.startQuestionnaire();
      });
    }

    startQuestionnaire() {
      // Redirect to questionnaire or show inline
      this.trackEvent('questionnaire_started');
      // For now, redirect to a questionnaire page
      window.open('/pages/skin-questionnaire', '_blank');
    }

    displayRoutine(routines, content) {
      const amRoutine = routines.find(r => r.routine_type === 'am');
      const pmRoutine = routines.find(r => r.routine_type === 'pm');

      content.innerHTML = `
        <div class="flashai-vto-routine-display">
          ${amRoutine ? this.renderRoutineCard(amRoutine, 'Morning', '☀️') : ''}
          ${pmRoutine ? this.renderRoutineCard(pmRoutine, 'Evening', '🌙') : ''}
        </div>
      `;

      // Attach event listeners for routine interactions
      this.attachRoutineEventListeners(content);
    }

    renderRoutineCard(routine, title, icon) {
      const routineId = routine.id || `routine-${title.toLowerCase()}`;
      return `
        <div class="flashai-vto-routine-card" data-routine-id="${routineId}">
          <div class="flashai-vto-routine-card-header">
            <span class="flashai-vto-routine-card-icon">${icon}</span>
            <h4>${title} Routine</h4>
            <span class="flashai-vto-routine-time-estimate">${this.calculateRoutineTime(routine.steps)} min</span>
          </div>

          <!-- Start Button (shown initially) -->
          <div class="flashai-vto-routine-start-section" data-routine="${routineId}">
            <p class="flashai-vto-routine-ready-text">Ready to start your ${title.toLowerCase()} routine?</p>
            <button class="flashai-vto-routine-start-btn" style="background-color: ${this.config.primaryColor}" data-routine="${routineId}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Start Routine
            </button>
          </div>

          <!-- Steps (hidden initially, shown after Start) -->
          <div class="flashai-vto-routine-steps" data-routine="${routineId}" style="display: none;">
            ${routine.steps.map((step, i) => `
              <div class="flashai-vto-routine-step" data-step-index="${i}">
                <div class="flashai-vto-step-checkbox">
                  <input type="checkbox" id="step-${routineId}-${i}">
                  <label for="step-${routineId}-${i}"></label>
                </div>
                <span class="flashai-vto-step-number">${i + 1}</span>
                <div class="flashai-vto-step-content">
                  <strong>${this.formatStepType(step.step_type)}</strong>
                  ${step.custom_product_name ? `<span class="flashai-vto-step-product">${step.custom_product_name}</span>` : ''}
                  ${step.recommendation_reason ? `<span class="flashai-vto-step-reason">${step.recommendation_reason}</span>` : ''}
                  <span class="flashai-vto-step-duration">${step.duration_seconds || 30}s</span>
                </div>
                <div class="flashai-vto-step-timer" data-duration="${step.duration_seconds || 30}">
                  <span class="flashai-vto-timer-display">0:${String(step.duration_seconds || 30).padStart(2, '0')}</span>
                  <button class="flashai-vto-timer-btn" title="Start timer">▶</button>
                </div>
              </div>
            `).join('')}

            <div class="flashai-vto-routine-complete-section">
              <button class="flashai-vto-routine-complete-btn" style="background-color: ${this.config.primaryColor}" data-routine="${routineId}">
                ✓ Mark Routine Complete
              </button>
            </div>
          </div>
        </div>
      `;
    }

    calculateRoutineTime(steps) {
      if (!steps) return 0;
      const totalSeconds = steps.reduce((sum, step) => sum + (step.duration_seconds || 30), 0);
      return Math.ceil(totalSeconds / 60);
    }

    formatStepType(stepType) {
      const labels = {
        cleanser: 'Cleanser',
        toner: 'Toner',
        serum: 'Serum',
        moisturizer: 'Moisturizer',
        sunscreen: 'Sunscreen',
        eye_cream: 'Eye Cream',
        exfoliant: 'Exfoliant',
        treatment: 'Treatment',
        face_oil: 'Face Oil',
        makeup_remover: 'Makeup Remover'
      };
      return labels[stepType] || stepType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    attachRoutineEventListeners(content) {
      // Start buttons
      content.querySelectorAll('.flashai-vto-routine-start-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const routineId = e.target.closest('[data-routine]').dataset.routine;
          this.startRoutine(routineId);
        });
      });

      // Timer buttons
      content.querySelectorAll('.flashai-vto-timer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const stepEl = e.target.closest('.flashai-vto-routine-step');
          this.toggleStepTimer(stepEl);
        });
      });

      // Complete buttons
      content.querySelectorAll('.flashai-vto-routine-complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const routineId = e.target.dataset.routine;
          this.completeRoutine(routineId);
        });
      });

      // Checkbox change
      content.querySelectorAll('.flashai-vto-step-checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const stepEl = e.target.closest('.flashai-vto-routine-step');
          stepEl.classList.toggle('completed', e.target.checked);
        });
      });
    }

    startRoutine(routineId) {
      const card = document.querySelector(`.flashai-vto-routine-card[data-routine-id="${routineId}"]`);
      if (!card) return;

      // Hide start section, show steps
      const startSection = card.querySelector('.flashai-vto-routine-start-section');
      const stepsSection = card.querySelector('.flashai-vto-routine-steps');

      if (startSection) startSection.style.display = 'none';
      if (stepsSection) stepsSection.style.display = 'block';

      this.trackEvent('routine_started', { routineId });
    }

    toggleStepTimer(stepEl) {
      const timerEl = stepEl.querySelector('.flashai-vto-step-timer');
      const displayEl = timerEl.querySelector('.flashai-vto-timer-display');
      const btnEl = timerEl.querySelector('.flashai-vto-timer-btn');
      const duration = parseInt(timerEl.dataset.duration) || 30;

      if (timerEl.dataset.running === 'true') {
        // Stop timer
        clearInterval(parseInt(timerEl.dataset.intervalId));
        timerEl.dataset.running = 'false';
        btnEl.textContent = '▶';
        return;
      }

      // Start timer
      let remaining = duration;
      timerEl.dataset.running = 'true';
      btnEl.textContent = '⏸';

      const intervalId = setInterval(() => {
        remaining--;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        displayEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;

        if (remaining <= 0) {
          clearInterval(intervalId);
          timerEl.dataset.running = 'false';
          btnEl.textContent = '✓';

          // Auto-check the step
          const checkbox = stepEl.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = true;
            stepEl.classList.add('completed');
          }

          // Play a subtle sound or vibrate if available
          if (navigator.vibrate) navigator.vibrate(200);
        }
      }, 1000);

      timerEl.dataset.intervalId = intervalId;
    }

    async completeRoutine(routineId) {
      const card = document.querySelector(`.flashai-vto-routine-card[data-routine-id="${routineId}"]`);
      if (!card) return;

      const completedSteps = Array.from(card.querySelectorAll('.flashai-vto-step-checkbox input:checked'))
        .map(cb => parseInt(cb.id.split('-').pop()));

      const btn = card.querySelector('.flashai-vto-routine-complete-btn');
      btn.textContent = 'Saving...';
      btn.disabled = true;

      try {
        const token = localStorage.getItem('flashai_token');
        if (token) {
          await fetch(this.config.apiBaseUrl.replace('/api/vto', '/api/widget/routines/log'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-API-Key': this.config.apiKey
            },
            body: JSON.stringify({
              routineId,
              stepsCompleted: completedSteps
            })
          });
        }

        btn.textContent = '✓ Completed!';
        btn.style.backgroundColor = '#10b981';

        this.trackEvent('routine_completed', { routineId, stepsCompleted: completedSteps.length });
      } catch (error) {
        console.error('Complete routine error:', error);
        btn.textContent = '✓ Mark Complete';
        btn.disabled = false;
      }
    }

    showLoggedOutRoutine() {
      const promo = document.getElementById('flashai-vto-routine-promo');
      const full = document.getElementById('flashai-vto-routine-full');

      if (promo) promo.style.display = 'block';
      if (full) full.style.display = 'none';
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
        signin: 'flashai-vto-step-signin',
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
      } else if (step === 'signin') {
        // Check if already logged in and update display
        if (this.state.user) {
          this.updateUserDisplay();
        }
      }
    }

    showSignInModal(type) {
      // Create sign-in modal
      const authOverlay = document.createElement('div');
      authOverlay.className = 'flashai-vto-auth-overlay';
      authOverlay.innerHTML = `
        <div class="flashai-vto-auth-modal">
          <button class="flashai-vto-auth-close">&times;</button>
          <div class="flashai-vto-auth-header">
            <h3>Sign In</h3>
            <p>Access your skin journey</p>
          </div>
          <form id="flashai-vto-signin-form" class="flashai-vto-auth-form">
            <div class="flashai-vto-form-group">
              <label>Email</label>
              <input type="email" id="flashai-vto-signin-email-input" placeholder="your@email.com" required>
            </div>
            <div class="flashai-vto-form-group">
              <label>Name (for new accounts)</label>
              <input type="text" id="flashai-vto-signin-name-input" placeholder="Your name">
            </div>
            <button type="submit" class="flashai-vto-auth-submit" style="background-color: ${this.config.primaryColor}">
              Continue
            </button>
          </form>
          <p class="flashai-vto-auth-terms">
            We'll create an account if you don't have one
          </p>
        </div>
      `;

      this.elements.modal.appendChild(authOverlay);

      // Close button
      authOverlay.querySelector('.flashai-vto-auth-close').addEventListener('click', () => {
        authOverlay.remove();
      });

      // Overlay click
      authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) authOverlay.remove();
      });

      // Form submit
      authOverlay.querySelector('#flashai-vto-signin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('flashai-vto-signin-email-input').value;
        const name = document.getElementById('flashai-vto-signin-name-input').value;
        await this.handleSignIn(email, name, authOverlay);
      });
    }

    async handleSignIn(email, name, authOverlay) {
      const submitBtn = authOverlay.querySelector('.flashai-vto-auth-submit');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Signing in...';
      submitBtn.disabled = true;

      try {
        const response = await fetch(this.config.apiBaseUrl.replace('/api/vto', '/api/widget/users'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
          },
          body: JSON.stringify({
            email,
            name,
            store_id: this.config.storeId,
            visitor_id: this.state.visitorId
          })
        });

        const data = await response.json();

        if (data.success) {
          // Store user info
          this.state.user = data.user;
          localStorage.setItem('flashai_user', JSON.stringify(data.user));
          localStorage.setItem('flashai_token', data.token);

          // Remove auth overlay
          authOverlay.remove();

          // Update displays
          this.updateUserDisplay();

          // Track sign-in
          this.trackEvent('user_signed_in', { method: 'email' });
        } else {
          throw new Error(data.error || 'Sign in failed');
        }
      } catch (error) {
        console.error('Sign in error:', error);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        alert('Sign in failed. Please try again.');
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

        const analyzeBtn = document.getElementById('flashai-vto-face-analyze');
        if (analyzeBtn) analyzeBtn.style.display = 'none';

        // Clear previous photos
        const photosContainer = document.getElementById('flashai-vto-face-photos');
        if (photosContainer) photosContainer.innerHTML = '';
      } catch (error) {
        console.error('Face camera access error:', error);
        this.showError('Camera access denied. Please allow camera access to use Face Scan.');
      }
    }

    stopFaceCamera() {
      if (this.state.faceCameraStream) {
        this.state.faceCameraStream.getTracks().forEach(track => track.stop());
        this.state.faceCameraStream = null;
      }
    }

    captureFacePhoto() {
      const video = document.getElementById('flashai-vto-face-camera');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

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
        } else {
          // All photos captured, show analyze button
          const captureBtn = document.getElementById('flashai-vto-face-capture');
          const analyzeBtn = document.getElementById('flashai-vto-face-analyze');

          if (captureBtn) captureBtn.style.display = 'none';
          if (analyzeBtn) analyzeBtn.style.display = 'block';

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
      // Store analysis for use in other tabs
      this.state.lastScanAnalysis = scan.analysis;

      // Update skin score
      const scoreElement = document.getElementById('flashai-vto-skin-score');
      if (scoreElement) {
        scoreElement.textContent = scan.analysis?.skin_score || '--';
      }

      // Update progress circle
      const scoreCircle = document.getElementById('flashai-vto-score-circle');
      if (scoreCircle && scan.analysis?.skin_score) {
        const score = scan.analysis.skin_score;
        const circumference = 2 * Math.PI * 54; // r=54
        const offset = circumference - (score / 100) * circumference;
        scoreCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        scoreCircle.style.strokeDashoffset = offset;
      }

      // Update metrics
      const metrics = ['pigmentation', 'acne', 'wrinkle', 'texture', 'redness', 'hydration'];
      metrics.forEach(metric => {
        // Use the correct selectors based on actual HTML structure
        const metricCard = document.getElementById(`flashai-vto-metric-${metric === 'wrinkle' ? 'wrinkles' : metric}`);
        if (!metricCard) return;

        const barElem = metricCard.querySelector('.flashai-vto-metric-fill');
        const scoreElem = metricCard.querySelector('.flashai-vto-metric-value');

        if (scoreElem && barElem && scan.analysis) {
          const score = scan.analysis[`${metric}_score`] || 0;
          scoreElem.textContent = `${score}%`;
          barElem.style.width = `${score}%`;

          // Color based on score (inverse for some metrics)
          const isGood = metric === 'texture' || metric === 'hydration';
          let color;
          if (isGood) {
            color = score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444';
          } else {
            color = score < 30 ? '#10b981' : score < 60 ? '#f59e0b' : '#ef4444';
          }
          barElem.style.backgroundColor = color;
        }
      });

      // Update skin details
      if (scan.analysis) {
        const toneElem = document.getElementById('flashai-vto-skin-tone');
        const undertoneElem = document.getElementById('flashai-vto-skin-undertone');
        const ageElem = document.getElementById('flashai-vto-skin-age');
        const hydrationElem = document.getElementById('flashai-vto-hydration-level');

        if (toneElem) toneElem.textContent = this.capitalizeFirst(scan.analysis.skin_tone) || 'N/A';
        if (undertoneElem) undertoneElem.textContent = this.capitalizeFirst(scan.analysis.skin_undertone) || 'N/A';
        if (ageElem) ageElem.textContent = scan.analysis.skin_age_estimate ? `~${scan.analysis.skin_age_estimate} years` : 'N/A';
        if (hydrationElem) hydrationElem.textContent = this.capitalizeFirst(scan.analysis.hydration_level) || 'N/A';
      }

      // Load product recommendations
      this.loadProductRecommendations(scan.id);

      // Show results step
      this.showStep('face-results');

      // Update routine tab focus based on analysis
      this.updateRoutineFocus(scan.analysis);

      // Check if user is logged in and update routine tab accordingly
      const savedUser = localStorage.getItem('flashai_user');
      if (savedUser) {
        this.state.user = JSON.parse(savedUser);
        this.showLoggedInRoutine();
      }
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
