/**
 * Flash AI VTO 3D Renderer
 * Three.js-based 3D viewer for virtual try-on
 *
 * Loads and displays 3D body meshes and garments with camera controls
 */

(function(window) {
  'use strict';

  class VTO3DRenderer {
    constructor(canvasElement, options = {}) {
      this.canvas = canvasElement;
      this.options = {
        backgroundColor: options.backgroundColor || 0xf0f0f0,
        cameraDistance: options.cameraDistance || 2.5,
        enableControls: options.enableControls !== false,
        autoRotate: options.autoRotate || false,
        ...options
      };

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.bodyMesh = null;
      this.garmentMesh = null;
      this.animationId = null;
      this.isInitialized = false;

      this.init();
    }

    // ==========================================================================
    // Initialization
    // ==========================================================================

    init() {
      try {
        // Check if Three.js is loaded
        if (typeof THREE === 'undefined') {
          console.error('Three.js is not loaded. Please include Three.js before the VTO widget.');
          return;
        }

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);

        // Create camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, this.options.cameraDistance);
        this.camera.lookAt(0, 0, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add lights
        this.setupLights();

        // Add controls if enabled
        if (this.options.enableControls && typeof THREE.OrbitControls !== 'undefined') {
          this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
          this.controls.enableDamping = true;
          this.controls.dampingFactor = 0.05;
          this.controls.screenSpacePanning = false;
          this.controls.minDistance = 1;
          this.controls.maxDistance = 5;
          this.controls.maxPolarAngle = Math.PI / 1.5;
          this.controls.autoRotate = this.options.autoRotate;
          this.controls.autoRotateSpeed = 2.0;
        }

        // Add grid helper (optional)
        if (this.options.showGrid) {
          const gridHelper = new THREE.GridHelper(10, 10);
          this.scene.add(gridHelper);
        }

        // Handle window resize
        this.onWindowResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.onWindowResize);

        this.isInitialized = true;

        // Start animation loop
        this.animate();

        console.log('VTO 3D Renderer initialized successfully');
      } catch (error) {
        console.error('Failed to initialize 3D renderer:', error);
      }
    }

    setupLights() {
      // Ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambientLight);

      // Main directional light (key light)
      const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
      keyLight.position.set(5, 5, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      this.scene.add(keyLight);

      // Fill light
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
      fillLight.position.set(-5, 0, -5);
      this.scene.add(fillLight);

      // Back light (rim light)
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(0, 5, -5);
      this.scene.add(backLight);
    }

    // ==========================================================================
    // Mesh Loading
    // ==========================================================================

    async loadBodyMesh(meshUrl) {
      try {
        if (!this.isInitialized) {
          throw new Error('Renderer not initialized');
        }

        // Remove existing body mesh
        if (this.bodyMesh) {
          this.scene.remove(this.bodyMesh);
          this.bodyMesh = null;
        }

        // Load mesh using GLTFLoader
        const loader = new THREE.GLTFLoader();

        return new Promise((resolve, reject) => {
          loader.load(
            meshUrl,
            (gltf) => {
              this.bodyMesh = gltf.scene;

              // Center the mesh
              const box = new THREE.Box3().setFromObject(this.bodyMesh);
              const center = box.getCenter(new THREE.Vector3());
              this.bodyMesh.position.sub(center);

              // Scale to reasonable size
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);
              const scale = 1.5 / maxDim;
              this.bodyMesh.scale.setScalar(scale);

              // Apply material
              this.bodyMesh.traverse((child) => {
                if (child.isMesh) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0xffd7ba,  // Skin tone
                    roughness: 0.7,
                    metalness: 0.1
                  });
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });

              this.scene.add(this.bodyMesh);
              resolve(this.bodyMesh);
            },
            (progress) => {
              const percent = (progress.loaded / progress.total) * 100;
              console.log(`Loading body mesh: ${percent.toFixed(1)}%`);
            },
            (error) => {
              console.error('Error loading body mesh:', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        console.error('Failed to load body mesh:', error);
        throw error;
      }
    }

    async loadGarmentMesh(garmentUrl) {
      try {
        if (!this.isInitialized) {
          throw new Error('Renderer not initialized');
        }

        // Remove existing garment mesh
        if (this.garmentMesh) {
          this.scene.remove(this.garmentMesh);
          this.garmentMesh = null;
        }

        // Load garment mesh
        const loader = new THREE.GLTFLoader();

        return new Promise((resolve, reject) => {
          loader.load(
            garmentUrl,
            (gltf) => {
              this.garmentMesh = gltf.scene;

              // Apply garment material
              this.garmentMesh.traverse((child) => {
                if (child.isMesh) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0x2196f3,  // Blue garment
                    roughness: 0.8,
                    metalness: 0.2
                  });
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });

              this.scene.add(this.garmentMesh);
              resolve(this.garmentMesh);
            },
            undefined,
            (error) => {
              console.error('Error loading garment mesh:', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        console.error('Failed to load garment mesh:', error);
        throw error;
      }
    }

    // ==========================================================================
    // Rendering & Animation
    // ==========================================================================

    animate() {
      this.animationId = requestAnimationFrame(this.animate.bind(this));

      // Update controls
      if (this.controls) {
        this.controls.update();
      }

      // Render scene
      this.renderer.render(this.scene, this.camera);
    }

    // ==========================================================================
    // Camera Controls
    // ==========================================================================

    setCameraPosition(x, y, z) {
      this.camera.position.set(x, y, z);
      this.camera.lookAt(0, 0, 0);
    }

    resetCamera() {
      this.camera.position.set(0, 0, this.options.cameraDistance);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.reset();
      }
    }

    focusOnMesh(mesh) {
      if (!mesh) return;

      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // Add some padding

      this.camera.position.set(center.x, center.y, center.z + cameraZ);
      this.camera.lookAt(center);

      if (this.controls) {
        this.controls.target.copy(center);
      }
    }

    // ==========================================================================
    // Utility Methods
    // ==========================================================================

    handleResize() {
      if (!this.isInitialized) return;

      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
    }

    takeScreenshot() {
      if (!this.isInitialized) return null;

      // Render one frame
      this.renderer.render(this.scene, this.camera);

      // Get image data
      return this.renderer.domElement.toDataURL('image/png');
    }

    setBackgroundColor(color) {
      this.scene.background = new THREE.Color(color);
    }

    toggleAutoRotate() {
      if (this.controls) {
        this.controls.autoRotate = !this.controls.autoRotate;
        return this.controls.autoRotate;
      }
      return false;
    }

    // ==========================================================================
    // Cleanup
    // ==========================================================================

    dispose() {
      // Stop animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }

      // Remove event listeners
      window.removeEventListener('resize', this.onWindowResize);

      // Dispose controls
      if (this.controls) {
        this.controls.dispose();
      }

      // Dispose meshes
      if (this.bodyMesh) {
        this.scene.remove(this.bodyMesh);
      }
      if (this.garmentMesh) {
        this.scene.remove(this.garmentMesh);
      }

      // Dispose renderer
      if (this.renderer) {
        this.renderer.dispose();
      }

      this.isInitialized = false;
    }
  }

  // Export to window
  window.VTO3DRenderer = VTO3DRenderer;

})(window);
