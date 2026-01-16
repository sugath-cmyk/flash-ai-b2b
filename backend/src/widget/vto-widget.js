/**
 * Flash AI Virtual Try-On & Face Scan Widget
 * Version: 1.5.0 (Vertical Card Layout with Problem & Solution)
 *
 * Embeddable widget for virtual try-on and face scan functionality
 *
 * Usage:
 * <script src="https://your-domain.com/api/vto/YOUR_STORE_ID.js"></script>
 */

(function() {
  'use strict';

  // Version check for debugging
  console.log('[Flash AI Widget] Version 1.5.0 - Vertical Card Layout with Problem & Solution');

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

          <!-- Face Scan Step 3: Results (Vertical Card Layout) -->
          <div id="flashai-vto-step-face-results" class="flashai-vto-step">
            <div class="flashai-vto-face-results-content">

              <!-- Summary Header -->
              <div class="flashai-vto-summary-header">
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
                <div class="flashai-vto-summary-details">
                  <h2>Your Skin Analysis</h2>
                  <div class="flashai-vto-quick-stats">
                    <span>Skin Age: <strong id="flashai-vto-skin-age">--</strong></span>
                    <span>Tone: <strong id="flashai-vto-skin-tone">--</strong></span>
                    <span>Undertone: <strong id="flashai-vto-skin-undertone">--</strong></span>
                  </div>
                </div>
              </div>

              <!-- Vertical Attribute Cards Container -->
              <div class="flashai-vto-attribute-cards-vertical" id="flashai-vto-attribute-cards">
                <!-- Cards will be dynamically generated -->
              </div>

              <!-- Hidden elements for backward compatibility -->
              <div style="display:none;">
                <div id="flashai-vto-hydration-level"></div>
                <div id="flashai-vto-metric-pigmentation"></div>
                <div id="flashai-vto-metric-acne"></div>
                <div id="flashai-vto-metric-wrinkles"></div>
                <div id="flashai-vto-metric-texture"></div>
                <div id="flashai-vto-metric-redness"></div>
                <div id="flashai-vto-metric-hydration"></div>
                <div id="flashai-vto-skin-summary"></div>
                <div id="flashai-vto-summary-concerns"></div>
                <div id="flashai-vto-summary-tips"></div>
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

      // Face scan result buttons
      modal.querySelector('#flashai-vto-new-scan').addEventListener('click', () => {
        this.showStep('selection');
        this.stopFaceCamera();
      });

      modal.querySelector('#flashai-vto-shop-recommended').addEventListener('click', () => {
        this.shopRecommendedProducts();
      });
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

      // Store first photo (front view) as base64 for displaying in results
      if (this.state.facePhotos.length === 0) {
        this.state.faceImageData = canvas.toDataURL('image/jpeg', 0.9);
      }

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
      // Store analysis for overlay drawing
      this.state.currentAnalysis = scan.analysis;

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

      // Update skin details
      if (scan.analysis) {
        const toneElem = document.getElementById('flashai-vto-skin-tone');
        const undertoneElem = document.getElementById('flashai-vto-skin-undertone');
        const ageElem = document.getElementById('flashai-vto-skin-age');

        if (toneElem) toneElem.textContent = this.capitalizeFirst(scan.analysis.skin_tone) || 'N/A';
        if (undertoneElem) undertoneElem.textContent = this.capitalizeFirst(scan.analysis.skin_undertone) || 'N/A';
        if (ageElem) ageElem.textContent = scan.analysis.skin_age_estimate ? `~${scan.analysis.skin_age_estimate}` : 'N/A';
      }

      // Generate vertical attribute cards
      this.generateVerticalAttributeCards(scan.analysis);

      // Load product recommendations
      this.loadProductRecommendations(scan.id);

      // Show results step
      this.showStep('face-results');
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
        }
      };
    }

    generateVerticalAttributeCards(analysis) {
      const container = document.getElementById('flashai-vto-attribute-cards');
      if (!container || !analysis) return;

      const attributes = this.getAttributeDefinitions();
      const faceImageData = this.state.faceImageData;

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
        const problem = attr.getProblem(analysis, score);
        const solution = attr.getSolution(analysis, score);

        // Determine severity level for styling
        let severity, severityLabel;
        if (attr.isGood) {
          severity = score > 70 ? 'good' : score > 40 ? 'moderate' : 'concern';
          severityLabel = score > 70 ? 'Good' : score > 40 ? 'Moderate' : 'Needs Attention';
        } else {
          severity = score < 30 ? 'good' : score < 60 ? 'moderate' : 'concern';
          severityLabel = score < 30 ? 'Good' : score < 60 ? 'Moderate' : 'Needs Attention';
        }

        return `
          <div class="flashai-vto-vertical-card" data-attribute="${key}" data-severity="${severity}">
            <div class="flashai-vto-card-header">
              <div class="flashai-vto-card-title">
                <span class="flashai-vto-card-icon">${attr.icon}</span>
                <h3>${attr.name}</h3>
              </div>
              <div class="flashai-vto-card-score ${severity}">
                <span class="flashai-vto-score-value">${Math.round(score)}%</span>
                <span class="flashai-vto-severity-label">${severityLabel}</span>
              </div>
            </div>

            <div class="flashai-vto-card-body">
              <div class="flashai-vto-card-image">
                <img src="${faceImageData}" alt="Face analysis for ${attr.name}" />
                <canvas class="flashai-vto-card-overlay" data-attribute="${key}"></canvas>
              </div>

              <div class="flashai-vto-card-analysis">
                <div class="flashai-vto-analysis-section">
                  <h4>What We Found</h4>
                  <p>${problem}</p>
                </div>

                <div class="flashai-vto-analysis-section solution">
                  <h4>Recommended Solution</h4>
                  <p>${solution}</p>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Initialize overlays for each card after images load
      container.querySelectorAll('.flashai-vto-card-image img').forEach(img => {
        if (img.complete) {
          this.initCardOverlay(img);
        } else {
          img.onload = () => this.initCardOverlay(img);
        }
      });
    }

    initCardOverlay(img) {
      const canvas = img.parentElement.querySelector('canvas');
      if (!canvas) return;

      const attribute = canvas.dataset.attribute;

      // Set canvas size to match image display size
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;

      // Draw the overlay for this attribute
      this.drawCardOverlay(canvas, attribute);
    }

    drawCardOverlay(canvas, attribute) {
      const ctx = canvas.getContext('2d');
      const analysis = this.state.currentAnalysis;
      const w = canvas.width;
      const h = canvas.height;

      if (!analysis) return;

      ctx.clearRect(0, 0, w, h);

      // Draw face outline first
      this.drawFaceOutlineOnCanvas(ctx, analysis, w, h);

      // Draw attribute-specific overlay
      const overlayMap = {
        'dark_circles': () => this.drawDarkCirclesOverlay(ctx, analysis, w, h),
        'pores': () => this.drawPoresOverlay(ctx, analysis, w, h),
        'wrinkles': () => this.drawWrinklesOverlay(ctx, analysis, w, h),
        'hydration': () => this.drawFullFaceHighlight(ctx, w, h, 'rgba(59, 130, 246, 0.15)', analysis),
        'acne': () => this.drawAcneOverlay(ctx, analysis, w, h),
        'redness': () => this.drawRednessOverlay(ctx, analysis, w, h),
        'oiliness': () => this.drawTZoneOverlay(ctx, w, h),
        'pigmentation': () => this.drawPigmentationOverlay(ctx, analysis, w, h),
        'texture': () => this.drawTextureOverlay(ctx, w, h, analysis)
      };

      const drawFn = overlayMap[attribute];
      if (drawFn) drawFn();
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

    drawDarkCirclesOverlay(ctx, analysis, w, h) {
      const regions = analysis.dark_circles_regions;
      if (!regions) return;

      ctx.fillStyle = 'rgba(147, 51, 234, 0.35)';
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.8)';
      ctx.lineWidth = 2;

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
          ctx.roundRect(rx, ry, rw, rh, 4);
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    drawPoresOverlay(ctx, analysis, w, h) {
      const pores = analysis.enlarged_pores_locations || [];

      // Draw T-zone highlight
      ctx.fillStyle = 'rgba(147, 51, 234, 0.12)';
      ctx.fillRect(0.35 * w, 0.15 * h, 0.3 * w, 0.55 * h);

      // Draw pore markers
      pores.forEach(pore => {
        ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
        ctx.strokeStyle = 'rgba(200, 150, 0, 1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pore.x * w, pore.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    drawWrinklesOverlay(ctx, analysis, w, h) {
      const regions = analysis.wrinkle_regions;
      if (!regions) return;

      Object.entries(regions).forEach(([name, region]) => {
        if (region && region.bbox && region.severity > 0.1) {
          const [x1, y1, x2, y2] = region.bbox;
          const intensity = Math.min(0.4, region.severity * 0.5);

          ctx.fillStyle = `rgba(147, 51, 234, ${intensity})`;
          ctx.strokeStyle = 'rgba(147, 51, 234, 0.7)';
          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.roundRect(x1 * w, y1 * h, (x2 - x1) * w, (y2 - y1) * h, 4);
          ctx.fill();
          ctx.stroke();

          // Draw lines pattern for wrinkles
          ctx.strokeStyle = 'rgba(147, 51, 234, 0.5)';
          ctx.lineWidth = 1;
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

    drawAcneOverlay(ctx, analysis, w, h) {
      const acneLocations = analysis.acne_locations || [];

      // Draw acne spots as yellow dots
      acneLocations.forEach(spot => {
        const size = spot.size === 'large' ? 6 : spot.size === 'medium' ? 4 : 3;
        ctx.fillStyle = spot.type === 'pimple' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 200, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(spot.x * w, spot.y * h, size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    drawRednessOverlay(ctx, analysis, w, h) {
      const regions = analysis.redness_regions || [];

      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';

      regions.forEach(region => {
        if (region.bbox) {
          const [x1, y1, x2, y2] = region.bbox;
          ctx.fillRect(x1 * w, y1 * h, (x2 - x1) * w, (y2 - y1) * h);
        }
      });
    }

    drawTZoneOverlay(ctx, w, h) {
      // T-zone: forehead + nose area
      ctx.fillStyle = 'rgba(147, 51, 234, 0.2)';

      // Forehead
      ctx.fillRect(0.25 * w, 0.08 * h, 0.5 * w, 0.17 * h);

      // Nose
      ctx.fillRect(0.38 * w, 0.25 * h, 0.24 * w, 0.45 * h);
    }

    drawPigmentationOverlay(ctx, analysis, w, h) {
      const spots = analysis.dark_spots_locations || [];

      // Draw dark spots
      ctx.fillStyle = 'rgba(139, 69, 19, 0.7)';
      spots.forEach(spot => {
        const size = Math.max(3, Math.min(8, spot.size * 50));
        ctx.beginPath();
        ctx.arc(spot.x * w, spot.y * h, size, 0, Math.PI * 2);
        ctx.fill();
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

    drawTextureOverlay(ctx, w, h, analysis) {
      // Highlight cheeks and forehead where texture is most visible
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1;

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
