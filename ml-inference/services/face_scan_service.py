"""
Face Scan & Skin Analysis Service
Real skin analysis using OpenCV with optional MediaPipe enhancement
"""

import time
from typing import List, Dict, Any, Optional, Tuple
import io
import math
import os

import cv2
import numpy as np
from PIL import Image

# Try to import MediaPipe, but make it optional
MEDIAPIPE_AVAILABLE = False
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision
    MEDIAPIPE_AVAILABLE = True
except Exception:
    pass


class FaceScanService:
    """Service for face scanning and real skin analysis using computer vision"""

    def __init__(self):
        # Initialize face detection (with fallbacks)
        self._init_face_detection()

        # Initialize face region landmark indices
        self._init_face_regions()

        self._ready = True
        self._model_info = {
            "name": "FaceScan-v3",
            "version": "3.0.0",
            "capabilities": [
                "skin_tone_detection",
                "skin_analysis",
                "problem_detection",
                "age_estimation",
                "face_shape_classification",
                "lighting_normalization",
                "blur_detection",
                "image_quality_assessment"
            ],
            "engine": "OpenCV" + (" + MediaPipe" if self.use_mediapipe else ""),
            "improvements": [
                "Multi-factor age estimation (10-90 range)",
                "Direction-aware wrinkle detection",
                "Lighting normalization for consistency",
                "Blur detection with quality warnings",
                "Regional wrinkle analysis (forehead, crow's feet, nasolabial)"
            ]
        }

    def _init_face_detection(self):
        """Initialize face detection with fallback options"""
        self.face_landmarker = None
        self.use_mediapipe = False
        self.face_cascade = None

        # Try MediaPipe first
        if MEDIAPIPE_AVAILABLE:
            try:
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                model_dir = os.path.join(base_dir, "models")
                model_path = os.path.join(model_dir, "face_landmarker.task")

                # Download model if not exists
                if not os.path.exists(model_path):
                    self._download_face_model(model_dir, model_path)

                if os.path.exists(model_path):
                    base_options = mp_python.BaseOptions(model_asset_path=model_path)
                    options = vision.FaceLandmarkerOptions(
                        base_options=base_options,
                        running_mode=vision.RunningMode.IMAGE,
                        num_faces=1,
                        min_face_detection_confidence=0.5,
                        min_face_presence_confidence=0.5,
                        min_tracking_confidence=0.5,
                        output_face_blendshapes=False,
                        output_facial_transformation_matrixes=False
                    )
                    self.face_landmarker = vision.FaceLandmarker.create_from_options(options)
                    self.use_mediapipe = True
                    print("Using MediaPipe Face Landmarker")
            except Exception as e:
                print(f"MediaPipe initialization failed: {e}")

        # Always load OpenCV Haar Cascade as fallback
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            if self.face_cascade.empty():
                print("Warning: Haar Cascade loaded but is empty")
                self.face_cascade = None
            else:
                print("OpenCV Haar Cascade loaded as fallback")
        except Exception as e:
            print(f"OpenCV face cascade failed: {e}")

    def _download_face_model(self, model_dir: str, model_path: str):
        """Download the MediaPipe face landmarker model"""
        import urllib.request

        model_url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

        try:
            print(f"Downloading face landmarker model...")
            os.makedirs(model_dir, exist_ok=True)
            urllib.request.urlretrieve(model_url, model_path)
            print(f"Model downloaded successfully to {model_path}")
        except Exception as e:
            print(f"Failed to download model: {e}")

    def _init_face_regions(self):
        """Define facial region landmark indices for targeted analysis"""

        # Face oval (jawline + forehead boundary)
        self.FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                         397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                         172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

        # Forehead region
        self.FOREHEAD = [10, 338, 297, 332, 284, 251, 21, 54, 103, 67, 109, 108,
                        69, 104, 68, 71, 70, 63, 105, 66, 107, 9, 336, 296, 334,
                        293, 301, 298, 333, 299, 337, 151]

        # Left cheek
        self.LEFT_CHEEK = [116, 117, 118, 119, 100, 126, 209, 49, 129, 203,
                          205, 206, 207, 216, 212, 202, 204, 194, 32, 140, 171]

        # Right cheek
        self.RIGHT_CHEEK = [345, 346, 347, 348, 329, 355, 429, 279, 358,
                           423, 425, 426, 427, 436, 432, 422, 424, 418, 262, 369, 396]

        # Nose region
        self.NOSE = [1, 2, 3, 4, 5, 6, 168, 195, 197, 45, 220, 115, 48,
                    64, 98, 97, 326, 327, 294, 278, 344, 440, 275, 19, 94, 141]

        # Chin/jawline
        self.CHIN = [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
                    127, 162, 21, 54, 103, 67, 109, 377, 378, 379, 365, 397, 288]

        # T-zone (forehead + nose)
        self.T_ZONE = self.FOREHEAD + self.NOSE

        # Under-eye regions
        self.LEFT_UNDER_EYE = [111, 117, 118, 119, 120, 121, 128, 245, 193, 55, 65, 52, 53]
        self.RIGHT_UNDER_EYE = [340, 346, 347, 348, 349, 350, 357, 465, 417, 285, 295, 282, 283]

        # Crow's feet areas (outer eye corners)
        self.LEFT_CROWS_FEET = [130, 247, 30, 29, 27, 28, 56, 190, 243, 112, 26, 22, 23]
        self.RIGHT_CROWS_FEET = [359, 467, 260, 259, 257, 258, 286, 414, 463, 341, 256, 252, 253]

        # Nasolabial fold regions
        self.LEFT_NASOLABIAL = [204, 205, 206, 207, 216, 212, 202, 57, 186, 92, 165, 167]
        self.RIGHT_NASOLABIAL = [424, 425, 426, 427, 436, 432, 422, 287, 410, 322, 391, 393]

        # Lip region (to exclude from skin analysis)
        self.LIPS = list(range(61, 96)) + list(range(146, 150)) + list(range(178, 182)) + \
                   list(range(308, 312)) + list(range(402, 406))

        # Eye regions (to exclude)
        self.LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
        self.RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

    def _normalize_lighting(self, img: np.ndarray, mask: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Normalize lighting conditions for consistent analysis.

        This reduces the impact of:
        - Uneven lighting (shadows, highlights)
        - Camera flash/specular reflections
        - White balance variations
        - Over/under exposure

        Args:
            img: BGR image
            mask: Optional face mask to focus normalization on face region

        Returns:
            Lighting-normalized BGR image
        """
        # Convert to LAB color space
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # === Step 1: CLAHE on L channel for contrast normalization ===
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        l_normalized = clahe.apply(l_channel)

        # === Step 2: Reduce specular highlights ===
        # Find very bright areas (likely flash/specular)
        _, highlight_mask = cv2.threshold(l_channel, 240, 255, cv2.THRESH_BINARY)

        # Reduce highlight intensity
        if np.sum(highlight_mask) > 0:
            # Blend with surrounding areas
            highlight_reduction = cv2.GaussianBlur(l_normalized, (15, 15), 0)
            l_normalized = np.where(
                highlight_mask > 0,
                np.clip(l_normalized * 0.7 + highlight_reduction * 0.3, 0, 255).astype(np.uint8),
                l_normalized
            )

        # === Step 3: Shadow recovery ===
        # Find very dark areas
        _, shadow_mask = cv2.threshold(l_channel, 40, 255, cv2.THRESH_BINARY_INV)

        if np.sum(shadow_mask) > 0:
            # Lift shadows slightly
            shadow_lift = cv2.add(l_normalized, np.ones_like(l_normalized) * 15)
            l_normalized = np.where(
                shadow_mask > 0,
                np.clip(l_normalized * 0.6 + shadow_lift * 0.4, 0, 255).astype(np.uint8),
                l_normalized
            )

        # === Step 4: Local normalization for uneven lighting ===
        if mask is not None:
            # Calculate local mean brightness in face region
            kernel = np.ones((31, 31), np.float32) / (31 * 31)
            local_mean = cv2.filter2D(l_normalized.astype(np.float32), -1, kernel)

            # Target brightness (neutral gray)
            target_brightness = 140

            # Calculate correction factor
            correction = target_brightness - local_mean
            correction = np.clip(correction, -40, 40)  # Limit correction

            # Apply correction only to face region
            l_corrected = l_normalized.astype(np.float32) + correction
            l_normalized = np.clip(l_corrected, 0, 255).astype(np.uint8)

        # === Step 5: Merge and convert back ===
        lab_normalized = cv2.merge([l_normalized, a_channel, b_channel])
        img_normalized = cv2.cvtColor(lab_normalized, cv2.COLOR_LAB2BGR)

        return img_normalized

    def _detect_blur(self, img: np.ndarray, mask: np.ndarray) -> Dict:
        """
        Detect image blur using Laplacian variance method.

        A blurry image will have low variance in the Laplacian.

        Returns:
            Dictionary with blur metrics
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply mask to focus on face region
        face_gray = cv2.bitwise_and(gray, gray, mask=mask)

        # Calculate Laplacian variance
        laplacian = cv2.Laplacian(face_gray, cv2.CV_64F)
        lap_var = laplacian.var()

        # Also check gradient magnitude
        sobel_x = cv2.Sobel(face_gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(face_gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
        grad_mean = np.mean(gradient_magnitude[mask > 0]) if np.sum(mask > 0) > 0 else 0

        # Determine blur level
        # Typical values:
        # - Sharp image: lap_var > 500, grad_mean > 30
        # - Slightly blurry: lap_var 200-500, grad_mean 15-30
        # - Very blurry: lap_var < 200, grad_mean < 15

        if lap_var > 500 and grad_mean > 30:
            blur_level = "sharp"
            sharpness_score = min(1.0, lap_var / 800)
        elif lap_var > 200 and grad_mean > 15:
            blur_level = "slightly_blurry"
            sharpness_score = 0.5 + (lap_var - 200) / 600
        elif lap_var > 100:
            blur_level = "blurry"
            sharpness_score = 0.3 + (lap_var - 100) / 400
        else:
            blur_level = "very_blurry"
            sharpness_score = max(0.1, lap_var / 400)

        return {
            "blur_level": blur_level,
            "sharpness_score": round(min(1.0, sharpness_score), 3),
            "laplacian_variance": float(lap_var),
            "gradient_mean": float(grad_mean),
            # ADJUSTED: Moderate thresholds for better accuracy while still accepting webcam images
            # Original was 150/12, relaxed was 50/5, now using 80/8 as balanced compromise
            "is_acceptable": bool(lap_var > 80 and grad_mean > 8)
        }

    def _estimate_lighting_quality(self, img: np.ndarray, mask: np.ndarray) -> Dict:
        """
        Estimate lighting quality for confidence scoring.

        Returns:
            Dictionary with lighting metrics
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        skin_brightness = gray[mask > 0]

        if len(skin_brightness) == 0:
            return {"lighting_quality": 0.5, "lighting_issues": ["no_face_detected"]}

        mean_brightness = np.mean(skin_brightness)
        std_brightness = np.std(skin_brightness)
        min_brightness = np.min(skin_brightness)
        max_brightness = np.max(skin_brightness)

        issues = []
        quality = 1.0

        # Check for overexposure
        overexposed_ratio = np.sum(skin_brightness > 240) / len(skin_brightness)
        if overexposed_ratio > 0.1:
            issues.append("overexposed")
            quality -= 0.2

        # Check for underexposure
        underexposed_ratio = np.sum(skin_brightness < 30) / len(skin_brightness)
        if underexposed_ratio > 0.1:
            issues.append("underexposed")
            quality -= 0.2

        # Check for uneven lighting (high std deviation)
        if std_brightness > 50:
            issues.append("uneven_lighting")
            quality -= 0.15

        # Check for optimal brightness range
        if mean_brightness < 80 or mean_brightness > 200:
            issues.append("poor_exposure")
            quality -= 0.15

        # Check dynamic range
        dynamic_range = max_brightness - min_brightness
        if dynamic_range < 60:
            issues.append("low_contrast")
            quality -= 0.1

        return {
            "lighting_quality": max(0.2, min(1.0, quality)),
            "lighting_issues": issues,
            "mean_brightness": float(mean_brightness),
            "brightness_std": float(std_brightness)
        }

    def _convert_to_python_types(self, obj):
        """
        Recursively convert numpy types to Python native types for JSON serialization.
        Fixes 'numpy.bool' object is not iterable' and similar errors.
        """
        if isinstance(obj, dict):
            return {key: self._convert_to_python_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_python_types(item) for item in obj]
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.integer):  # Covers all numpy integer types
            return int(obj)
        elif isinstance(obj, np.floating):  # Covers all numpy float types
            return float(obj)
        elif isinstance(obj, np.str_):
            return str(obj)
        else:
            return obj

    def is_ready(self) -> bool:
        """Check if service is ready"""
        return self._ready

    def get_model_info(self) -> Dict:
        """Get model information"""
        return self._model_info

    def reload_models(self):
        """Reload ML models"""
        # Reinitialize face detection
        self._init_face_detection()
        self._ready = True

    async def analyze_face(self, scan_id: str, image_data: List[bytes]) -> Dict[str, Any]:
        """
        Analyze facial images for comprehensive skin analysis using MULTIPLE VIEWS.

        Uses all available images (front, left profile, right profile) for more
        accurate and comprehensive skin analysis. Each view captures different
        areas of the face that may not be visible in other views.

        Args:
            scan_id: Unique scan identifier
            image_data: List of image bytes (front, left, right)

        Returns:
            Dictionary containing quality_score and detailed analysis from all views
        """
        start_time = time.time()
        VIEW_NAMES = ['front', 'left', 'right']

        try:
            # Step 1: Load and preprocess ALL images
            images, face_data_list = self._process_images(image_data)

            if not face_data_list:
                return self._error_response(scan_id, "No face detected in images", time.time() - start_time)

            print(f"[FaceScan] Multi-view analysis: {len(images)} images with {len(face_data_list)} valid faces")

            # Step 2: Analyze each view and collect results
            view_analyses = []
            view_quality_scores = []
            primary_view_idx = 0  # Front view is primary

            for idx in range(len(images)):
                view_name = VIEW_NAMES[idx] if idx < len(VIEW_NAMES) else f'view_{idx}'
                img_original = images[idx]
                face_data = face_data_list[idx] if idx < len(face_data_list) else face_data_list[0]

                print(f"[FaceScan] Analyzing {view_name} view...")

                # Extract skin mask for this view
                skin_mask = self._create_skin_mask(img_original, face_data)

                # Normalize lighting
                img = self._normalize_lighting(img_original, skin_mask)

                # Check quality for this view
                lighting_info = self._estimate_lighting_quality(img_original, skin_mask)
                blur_info = self._detect_blur(img_original, skin_mask)

                # Skip view if quality is too poor (but continue with others)
                if not blur_info["is_acceptable"] or lighting_info["lighting_quality"] < 0.15:
                    print(f"[FaceScan] {view_name} view quality too low, skipping detailed analysis")
                    continue

                # Run analysis on this view
                view_analysis = self._analyze_single_view(img, img_original, skin_mask, face_data, view_name)
                view_analyses.append((view_name, view_analysis))

                # Calculate quality score for this view
                quality_score = self._calculate_quality_score(img_original, face_data, skin_mask)
                view_quality_scores.append(quality_score)

                print(f"[FaceScan] {view_name} view analysis complete - quality: {quality_score:.2f}")

            # Step 3: Check if we have any valid analyses
            if not view_analyses:
                # Fall back to single image analysis if all views failed quality check
                print("[FaceScan] All views failed quality check, falling back to best available")
                img_original = images[0]
                face_data = face_data_list[0]
                skin_mask = self._create_skin_mask(img_original, face_data)
                lighting_info = self._estimate_lighting_quality(img_original, skin_mask)
                blur_info = self._detect_blur(img_original, skin_mask)

                return self._convert_to_python_types({
                    "success": True,
                    "scan_id": scan_id,
                    "quality_score": max(blur_info["sharpness_score"], lighting_info["lighting_quality"]) * 0.5,
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "warning": "Image quality is poor. Results may be less accurate.",
                    "analysis": self._get_low_confidence_defaults(),
                    "views_analyzed": 0
                })

            # Step 4: Merge analyses from all views
            merged_analysis = self._merge_multi_view_analysis(view_analyses)

            # Add metadata about which views were used
            merged_analysis["views_analyzed"] = [v[0] for v in view_analyses]
            merged_analysis["multi_view"] = len(view_analyses) > 1

            # Calculate overall quality score (average of valid views)
            avg_quality = sum(view_quality_scores) / len(view_quality_scores) if view_quality_scores else 0.5

            processing_time = int((time.time() - start_time) * 1000)
            print(f"[FaceScan] Multi-view analysis complete: {len(view_analyses)} views in {processing_time}ms")

            return self._convert_to_python_types({
                "success": True,
                "scan_id": scan_id,
                "quality_score": avg_quality,
                "processing_time_ms": processing_time,
                "analysis": merged_analysis
            })

        except Exception as e:
            return self._error_response(scan_id, str(e), time.time() - start_time)

    def _analyze_single_view(self, img: np.ndarray, img_original: np.ndarray,
                             skin_mask: np.ndarray, face_data: Dict, view_name: str) -> Dict:
        """
        Analyze a single view (front/left/right) and return results with view context.

        Args:
            img: Lighting-normalized image
            img_original: Original image
            skin_mask: Mask for skin region
            face_data: Face detection data
            view_name: 'front', 'left', or 'right'

        Returns:
            Dictionary with analysis results including view-specific location data
        """
        # Extract skin region for analysis
        skin_region = cv2.bitwise_and(img, img, mask=skin_mask)

        analysis = {}
        analysis["_view"] = view_name  # Track which view this came from

        # Color analysis (only meaningful from front view)
        if view_name == 'front':
            try:
                skin_tone_result = self._analyze_skin_tone(skin_region, skin_mask)
                analysis.update(skin_tone_result)
            except Exception:
                analysis.update(self._default_skin_tone())

            # Undertone detection (front view only)
            try:
                undertone_result = self._analyze_undertone(skin_region, skin_mask)
                analysis.update(undertone_result)
            except Exception:
                analysis["skin_undertone"] = "neutral"

            # Face shape classification (front view only)
            try:
                face_shape_result = self._classify_face_shape(face_data, img.shape)
                analysis.update(face_shape_result)
            except Exception:
                analysis.update({"face_shape": "oval", "face_shape_confidence": 0.5})

            # Dark circles (front view - under eye area)
            try:
                dark_circles_result = self._detect_dark_circles(img, skin_mask, face_data)
                analysis.update(dark_circles_result)
            except Exception:
                analysis.update(self._default_dark_circles())

            # Extract face outline (front view only for overlay)
            try:
                face_outline = self._extract_face_outline(face_data, img.shape)
                analysis["face_outline"] = face_outline
            except Exception:
                analysis["face_outline"] = []

        # Acne/blemish detection (all views - side profiles catch cheek/jawline acne)
        try:
            acne_result = self._detect_acne(img, skin_mask, face_data)
            # Tag locations with view name
            if "acne_locations" in acne_result:
                for loc in acne_result["acne_locations"]:
                    loc["view"] = view_name
            analysis.update(acne_result)
        except Exception:
            analysis.update(self._default_acne())

        # Wrinkle detection (all views - profiles show crow's feet, nasolabial)
        try:
            wrinkle_result = self._detect_wrinkles(img, skin_mask, face_data)
            # Tag wrinkle regions with view
            if "wrinkle_regions" in wrinkle_result:
                for region_name in wrinkle_result["wrinkle_regions"]:
                    wrinkle_result["wrinkle_regions"][region_name]["view"] = view_name
            analysis.update(wrinkle_result)
        except Exception:
            analysis.update(self._default_wrinkles())

        # Texture analysis (all views)
        try:
            texture_result = self._analyze_texture(img, skin_mask)
            if "enlarged_pores_locations" in texture_result:
                for loc in texture_result["enlarged_pores_locations"]:
                    loc["view"] = view_name
            analysis.update(texture_result)
        except Exception:
            analysis.update(self._default_texture())

        # Redness/sensitivity (all views - cheek redness visible from profiles)
        try:
            redness_result = self._analyze_redness(img, skin_mask)
            if "redness_regions" in redness_result:
                for region in redness_result["redness_regions"]:
                    region["view"] = view_name
            analysis.update(redness_result)
        except Exception:
            analysis.update(self._default_redness())

        # Hydration/oiliness (front view mainly - T-zone analysis)
        if view_name == 'front':
            try:
                hydration_result = self._analyze_hydration(img, skin_mask, face_data)
                analysis.update(hydration_result)
            except Exception:
                analysis.update(self._default_hydration())

        # Pigmentation/dark spots (all views)
        try:
            pigmentation_result = self._detect_pigmentation(img, skin_mask)
            if "dark_spots_locations" in pigmentation_result:
                for loc in pigmentation_result["dark_spots_locations"]:
                    loc["view"] = view_name
            analysis.update(pigmentation_result)
        except Exception:
            analysis.update(self._default_pigmentation())

        return analysis

    def _merge_multi_view_analysis(self, view_analyses: List[Tuple[str, Dict]]) -> Dict:
        """
        Merge analysis results from multiple views into a comprehensive analysis.

        Strategy:
        - Skin tone/undertone/face shape: Use front view only
        - Counts (acne, spots, wrinkles): Sum across all views
        - Scores (texture, redness): Average across views
        - Locations: Combine from all views with view labels

        Args:
            view_analyses: List of (view_name, analysis_dict) tuples

        Returns:
            Merged analysis dictionary
        """
        merged = {}

        if not view_analyses:
            return self._get_low_confidence_defaults()

        # Get front view analysis as baseline (or first available)
        front_analysis = None
        for view_name, analysis in view_analyses:
            if view_name == 'front':
                front_analysis = analysis
                break
        if front_analysis is None:
            front_analysis = view_analyses[0][1]

        # Copy front-view-only fields
        front_only_fields = [
            'skin_tone', 'skin_hex_color', 'skin_tone_confidence',
            'skin_undertone', 'face_shape', 'face_shape_confidence',
            'dark_circles_score', 'dark_circles_severity',
            'hydration_score', 'hydration_level', 'oiliness_score', 't_zone_oiliness',
            'face_outline'
        ]
        for field in front_only_fields:
            if field in front_analysis:
                merged[field] = front_analysis[field]

        # Aggregate count fields (sum across views)
        count_fields = [
            'blackhead_count', 'pimple_count', 'whitehead_count',
            'dark_spots_count', 'fine_lines_count', 'deep_wrinkles_count',
            'enlarged_pores_count'
        ]
        for field in count_fields:
            total = 0
            for _, analysis in view_analyses:
                total += analysis.get(field, 0)
            merged[field] = total

        # Aggregate score fields (weighted average - front view gets more weight)
        # NOTE: All scores must be integers for database compatibility
        score_fields = [
            'acne_score', 'wrinkle_score', 'texture_score',
            'redness_score', 'pigmentation_score', 'smoothness_score'
        ]
        for field in score_fields:
            weighted_sum = 0
            weight_total = 0
            for view_name, analysis in view_analyses:
                if field in analysis:
                    value = analysis[field]
                    # Ensure value is numeric before multiplying
                    if isinstance(value, (int, float)):
                        weight = 1.5 if view_name == 'front' else 1.0
                        weighted_sum += value * weight
                        weight_total += weight
            if weight_total > 0:
                merged[field] = int(round(weighted_sum / weight_total))

        # Handle pore_size_average separately (float, average from views)
        pore_sizes = [a.get('pore_size_average', 0) for _, a in view_analyses if 'pore_size_average' in a]
        if pore_sizes:
            merged['pore_size_average'] = round(sum(pore_sizes) / len(pore_sizes), 2)

        # Handle categorical fields (take from front view)
        if 'sensitivity_level' in front_analysis:
            merged['sensitivity_level'] = front_analysis['sensitivity_level']

        # Combine location arrays from all views
        location_fields = [
            'acne_locations', 'dark_spots_locations', 'enlarged_pores_locations',
            'redness_regions'
        ]
        for field in location_fields:
            combined = []
            for view_name, analysis in view_analyses:
                if field in analysis and isinstance(analysis[field], list):
                    combined.extend(analysis[field])
            if combined:
                merged[field] = combined

        # Combine wrinkle regions (merge dicts)
        all_wrinkle_regions = {}
        for view_name, analysis in view_analyses:
            if 'wrinkle_regions' in analysis:
                for region_name, region_data in analysis['wrinkle_regions'].items():
                    key = f"{region_name}_{view_name}" if view_name != 'front' else region_name
                    all_wrinkle_regions[key] = region_data
        if all_wrinkle_regions:
            merged['wrinkle_regions'] = all_wrinkle_regions

        # Calculate overall skin score from merged data
        merged['skin_score'] = self._calculate_overall_score(merged)

        # Calculate skin age from merged data
        try:
            age_result = self._estimate_skin_age(merged)
            merged.update(age_result)
        except Exception:
            merged['skin_age_estimate'] = 30

        # Calculate analysis confidence (higher with more views)
        base_confidence = front_analysis.get('analysis_confidence', 0.7)
        view_bonus = min(0.15, 0.05 * (len(view_analyses) - 1))  # +5% per extra view
        merged['analysis_confidence'] = min(0.98, base_confidence + view_bonus)

        print(f"[FaceScan] Merged {len(view_analyses)} views: "
              f"acne={merged.get('acne_score', 0)}, spots={merged.get('dark_spots_count', 0)}, "
              f"wrinkles={merged.get('wrinkle_score', 0)}")

        return merged

    def _process_images(self, image_data: List[bytes]) -> Tuple[List[np.ndarray], List]:
        """Load images and detect faces"""
        images = []
        face_data_list = []

        print(f"[FaceScan] Processing {len(image_data)} images")

        for idx, img_bytes in enumerate(image_data):
            try:
                # Load image
                print(f"[FaceScan] Image {idx}: Loading {len(img_bytes)} bytes")
                img = Image.open(io.BytesIO(img_bytes))
                img_array = np.array(img)
                print(f"[FaceScan] Image {idx}: Shape {img_array.shape}, dtype {img_array.dtype}")

                # Convert to BGR for OpenCV
                if len(img_array.shape) == 3:
                    if img_array.shape[2] == 4:  # RGBA
                        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                    elif img_array.shape[2] == 3:  # RGB (PIL default)
                        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                    else:
                        print(f"[FaceScan] Image {idx}: Unsupported channels {img_array.shape[2]}")
                        continue
                elif len(img_array.shape) == 2:  # Grayscale
                    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)
                else:
                    print(f"[FaceScan] Image {idx}: Unsupported shape {img_array.shape}")
                    continue

                # Resize if too large (max 1920x1080)
                h, w = img_bgr.shape[:2]
                if h > 1080 or w > 1920:
                    scale = min(1920 / w, 1080 / h)
                    img_bgr = cv2.resize(img_bgr, None, fx=scale, fy=scale)
                    print(f"[FaceScan] Image {idx}: Resized to {img_bgr.shape[:2]}")

                # Ensure array is contiguous for MediaPipe
                img_bgr = np.ascontiguousarray(img_bgr)

                # Try MediaPipe first
                face_data = None
                if self.use_mediapipe and self.face_landmarker:
                    try:
                        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                        img_rgb = np.ascontiguousarray(img_rgb)
                        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
                        result = self.face_landmarker.detect(mp_image)
                        # Check face_landmarks explicitly to avoid numpy.bool issues
                        has_landmarks = result.face_landmarks is not None and len(result.face_landmarks) > 0
                        if has_landmarks:
                            landmarks = result.face_landmarks[0]
                            face_data = {"type": "landmarks", "data": landmarks}
                            print(f"[FaceScan] Image {idx}: MediaPipe detected {len(landmarks)} landmarks")
                        else:
                            print(f"[FaceScan] Image {idx}: MediaPipe no face detected")
                    except Exception as mp_err:
                        print(f"[FaceScan] Image {idx}: MediaPipe error: {mp_err}")

                # Fallback to OpenCV
                if face_data is None and self.face_cascade is not None:
                    try:
                        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
                        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
                        if len(faces) > 0:
                            x, y, fw, fh = faces[0]
                            face_data = {"type": "bbox", "data": (x, y, fw, fh)}
                            print(f"[FaceScan] Image {idx}: OpenCV detected face at ({x},{y},{fw},{fh})")
                        else:
                            print(f"[FaceScan] Image {idx}: OpenCV no face detected")
                    except Exception as cv_err:
                        print(f"[FaceScan] Image {idx}: OpenCV error: {cv_err}")

                if face_data:
                    images.append(img_bgr)
                    face_data_list.append(face_data)

            except Exception as e:
                print(f"[FaceScan] Image {idx}: Error processing: {e}")
                import traceback
                traceback.print_exc()
                continue

        print(f"[FaceScan] Successfully processed {len(images)} images with faces")
        return images, face_data_list

    def _create_skin_mask(self, img: np.ndarray, face_data: Dict) -> np.ndarray:
        """Create binary mask of skin region using face data"""
        h, w = img.shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)

        if face_data["type"] == "landmarks":
            landmarks = face_data["data"]

            def get_points(indices):
                points = []
                for idx in indices:
                    if idx < len(landmarks):
                        lm = landmarks[idx]
                        x, y = int(lm.x * w), int(lm.y * h)
                        points.append([x, y])
                return np.array(points, dtype=np.int32) if points else None

            # Fill face oval
            face_points = get_points(self.FACE_OVAL)
            if face_points is not None and len(face_points) >= 3:
                cv2.fillPoly(mask, [face_points], 255)

            # Exclude eye regions
            for eye_region in [self.LEFT_EYE, self.RIGHT_EYE]:
                eye_points = get_points(eye_region)
                if eye_points is not None and len(eye_points) >= 3:
                    cv2.fillPoly(mask, [eye_points], 0)

            # Exclude mouth/lip region
            lip_points = get_points(self.LIPS[:20])
            if lip_points is not None and len(lip_points) >= 3:
                hull = cv2.convexHull(lip_points)
                cv2.fillPoly(mask, [hull], 0)

        elif face_data["type"] == "bbox":
            # Use bounding box to create elliptical face mask
            x, y, fw, fh = face_data["data"]

            # Create elliptical mask for face region
            center = (x + fw // 2, y + fh // 2)
            axes = (fw // 2, int(fh * 0.6))  # Slightly taller ellipse
            cv2.ellipse(mask, center, axes, 0, 0, 360, 255, -1)

            # Approximate eye regions to exclude (top 30% of face)
            eye_y = y + int(fh * 0.25)
            eye_h = int(fh * 0.15)
            left_eye_x = x + int(fw * 0.15)
            right_eye_x = x + int(fw * 0.55)
            eye_w = int(fw * 0.3)

            cv2.ellipse(mask, (left_eye_x + eye_w // 2, eye_y + eye_h // 2),
                       (eye_w // 2, eye_h // 2), 0, 0, 360, 0, -1)
            cv2.ellipse(mask, (right_eye_x + eye_w // 2, eye_y + eye_h // 2),
                       (eye_w // 2, eye_h // 2), 0, 0, 360, 0, -1)

            # Approximate mouth region to exclude (bottom 20% of face)
            mouth_y = y + int(fh * 0.65)
            mouth_h = int(fh * 0.2)
            mouth_x = x + int(fw * 0.25)
            mouth_w = int(fw * 0.5)
            cv2.ellipse(mask, (mouth_x + mouth_w // 2, mouth_y + mouth_h // 2),
                       (mouth_w // 2, mouth_h // 2), 0, 0, 360, 0, -1)

        return mask

    def _analyze_skin_tone(self, skin_region: np.ndarray, mask: np.ndarray) -> Dict:
        """Analyze skin tone using LAB color space analysis"""

        # Extract only skin pixels
        skin_pixels = skin_region[mask > 0]

        if len(skin_pixels) == 0:
            return self._default_skin_tone()

        # Calculate mean colors in BGR
        mean_bgr = np.mean(skin_pixels, axis=0)

        # Convert to LAB for perceptual color analysis
        skin_lab = cv2.cvtColor(skin_region, cv2.COLOR_BGR2LAB)
        lab_pixels = skin_lab[mask > 0]
        mean_lab = np.mean(lab_pixels, axis=0)

        # L channel (0-255, maps to lightness)
        lightness = mean_lab[0]

        # Classify skin tone based on LAB lightness
        if lightness > 200:
            skin_tone = "fair"
        elif lightness > 175:
            skin_tone = "light"
        elif lightness > 150:
            skin_tone = "medium"
        elif lightness > 130:
            skin_tone = "olive"
        elif lightness > 110:
            skin_tone = "tan"
        elif lightness > 85:
            skin_tone = "brown"
        else:
            skin_tone = "dark"

        # Generate hex color
        mean_rgb = mean_bgr[::-1]  # BGR to RGB
        hex_color = "#{:02x}{:02x}{:02x}".format(
            int(np.clip(mean_rgb[0], 0, 255)),
            int(np.clip(mean_rgb[1], 0, 255)),
            int(np.clip(mean_rgb[2], 0, 255))
        )

        # Calculate confidence based on color variance
        color_std = np.std(skin_pixels, axis=0)
        confidence = max(0.5, min(0.98, 1.0 - (np.mean(color_std) / 60)))

        return {
            "skin_tone": skin_tone,
            "skin_hex_color": hex_color,
            "skin_tone_confidence": round(confidence, 3),
        }

    def _analyze_undertone(self, skin_region: np.ndarray, mask: np.ndarray) -> Dict:
        """Detect skin undertone using color temperature analysis"""

        skin_pixels = skin_region[mask > 0]
        if len(skin_pixels) == 0:
            return {"skin_undertone": "neutral"}

        # Convert to LAB color space
        skin_lab = cv2.cvtColor(skin_region, cv2.COLOR_BGR2LAB)
        lab_pixels = skin_lab[mask > 0]

        # A channel: negative = green, positive = red/magenta
        # B channel: negative = blue, positive = yellow
        mean_a = np.mean(lab_pixels[:, 1]) - 128  # Center around 0
        mean_b = np.mean(lab_pixels[:, 2]) - 128

        # Warm undertones: higher yellow (b) and red (a) values
        warmth_score = mean_a * 0.6 + mean_b * 0.4

        if warmth_score > 12:
            undertone = "warm"
        elif warmth_score < -8:
            undertone = "cool"
        else:
            undertone = "neutral"

        return {
            "skin_undertone": undertone,
        }

    def _classify_face_shape(self, face_data: Dict, img_shape: tuple) -> Dict:
        """Classify face shape based on facial geometry"""

        h, w = img_shape[:2]

        if face_data["type"] == "landmarks":
            landmarks = face_data["data"]

            def get_point(idx):
                lm = landmarks[idx]
                return np.array([lm.x * w, lm.y * h])

            # Key measurements
            forehead_left = get_point(54)
            forehead_right = get_point(284)
            forehead_width = np.linalg.norm(forehead_right - forehead_left)

            cheek_left = get_point(234)
            cheek_right = get_point(454)
            cheek_width = np.linalg.norm(cheek_right - cheek_left)

            jaw_left = get_point(172)
            jaw_right = get_point(397)
            jaw_width = np.linalg.norm(jaw_right - jaw_left)

            forehead_top = get_point(10)
            chin = get_point(152)
            face_length = np.linalg.norm(chin - forehead_top)

            # Calculate ratios
            length_to_width = face_length / max(cheek_width, 1)
            forehead_to_jaw = forehead_width / max(jaw_width, 1)
            cheek_to_jaw = cheek_width / max(jaw_width, 1)
            cheek_to_forehead = cheek_width / max(forehead_width, 1)

            # Classify face shape
            if length_to_width > 1.5:
                face_shape = "oblong"
                confidence = 0.85
            elif cheek_to_forehead > 1.15 and cheek_to_jaw > 1.15:
                face_shape = "diamond"
                confidence = 0.80
            elif forehead_to_jaw > 1.25:
                face_shape = "heart"
                confidence = 0.82
            elif length_to_width < 1.1 and cheek_to_jaw < 1.1:
                face_shape = "square"
                confidence = 0.80
            elif length_to_width < 1.2 and cheek_to_jaw > 0.95:
                face_shape = "round"
                confidence = 0.83
            else:
                face_shape = "oval"
                confidence = 0.88

        elif face_data["type"] == "bbox":
            # Estimate from bounding box aspect ratio
            x, y, fw, fh = face_data["data"]
            aspect_ratio = fh / max(fw, 1)

            if aspect_ratio > 1.4:
                face_shape = "oblong"
                confidence = 0.65
            elif aspect_ratio < 1.0:
                face_shape = "round"
                confidence = 0.65
            elif aspect_ratio < 1.15:
                face_shape = "square"
                confidence = 0.60
            else:
                face_shape = "oval"
                confidence = 0.70
        else:
            face_shape = "oval"
            confidence = 0.5

        return {
            "face_shape": face_shape,
            "face_shape_confidence": round(confidence, 3),
        }

    def _detect_acne(self, img: np.ndarray, mask: np.ndarray, face_data: Dict) -> Dict:
        """Detect acne and blemishes with HIGH ACCURACY multi-stage validation.

        STRICT ACCURACY MODE:
        - Multi-stage validation: each spot must pass multiple criteria
        - Contrast verification: spot must be significantly different from surroundings
        - Local intensity comparison: compare to immediate neighborhood
        - Only count high-confidence detections
        """

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray_masked = cv2.bitwise_and(gray, gray, mask=mask)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

        # Calculate skin baseline statistics for comparison
        skin_pixels = gray[mask > 0]
        if len(skin_pixels) == 0:
            return self._default_acne()

        skin_mean = np.mean(skin_pixels)
        skin_std = np.std(skin_pixels)

        # Detect red/inflamed areas - VERY STRICT: Only true inflammation
        # Increased saturation requirement to avoid detecting normal skin flush
        lower_red1 = np.array([0, 120, 80])  # Very high saturation required
        upper_red1 = np.array([6, 255, 255])   # Narrower hue range
        lower_red2 = np.array([174, 120, 80])  # Very high saturation
        upper_red2 = np.array([180, 255, 255])

        red_mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = cv2.bitwise_or(red_mask1, red_mask2)
        red_mask = cv2.bitwise_and(red_mask, mask)

        # Strong morphological cleaning
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        red_mask = cv2.morphologyEx(red_mask, cv2.MORPH_OPEN, kernel)
        red_mask = cv2.morphologyEx(red_mask, cv2.MORPH_CLOSE, kernel)

        # Blob detection with stronger blur to reduce texture noise
        blurred = cv2.GaussianBlur(gray_masked, (5, 5), 0)

        # Adaptive threshold - STRICT parameters
        thresh_dark = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 15, 5  # Larger block, higher C = stricter
        )
        thresh_dark = cv2.bitwise_and(thresh_dark, mask)
        thresh_dark = cv2.morphologyEx(thresh_dark, cv2.MORPH_OPEN, kernel)

        contours_dark, _ = cv2.findContours(thresh_dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        blackhead_count = 0
        pimple_count = 0
        whitehead_count = 0
        acne_locations = []

        # ULTRA STRICT: Much higher minimum area to avoid texture/pore false positives
        min_area = 90  # Increased from 50 - ignore spots that could be normal pores
        max_area = 400
        skin_area = max(np.sum(mask > 0), 1)
        area_scale = skin_area / 100000

        def verify_spot_contrast(cnt, spot_type="dark"):
            """Verify spot has significant contrast with surrounding skin"""
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                return False, 0, 0

            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            # Get spot intensity
            spot_mask = np.zeros_like(gray)
            cv2.drawContours(spot_mask, [cnt], -1, 255, -1)
            spot_pixels = gray[spot_mask > 0]
            if len(spot_pixels) == 0:
                return False, 0, 0

            spot_mean = np.mean(spot_pixels)

            # Get surrounding area intensity (dilate the contour)
            dilated = cv2.dilate(spot_mask, kernel, iterations=3)
            surround_mask = cv2.subtract(dilated, spot_mask)
            surround_mask = cv2.bitwise_and(surround_mask, mask)
            surround_pixels = gray[surround_mask > 0]

            if len(surround_pixels) < 10:
                return False, 0, 0

            surround_mean = np.mean(surround_pixels)

            # Calculate contrast ratio - ULTRA STRICT thresholds
            if spot_type == "dark":
                contrast = surround_mean - spot_mean
                # Must be VERY SIGNIFICANTLY darker than surroundings (35+ units)
                # AND much darker than overall skin mean (1.5 std devs)
                is_valid = contrast > 35 and spot_mean < skin_mean - 1.5 * skin_std
            else:  # bright
                contrast = spot_mean - surround_mean
                # Whiteheads must be much brighter - higher threshold
                is_valid = contrast > 40 and spot_mean > skin_mean + 2.0 * skin_std

            return is_valid, cx / w, cy / h

        # Detect blackheads with contrast verification
        for cnt in contours_dark:
            area = cv2.contourArea(cnt)
            scaled_min = min_area * max(area_scale, 0.5)
            scaled_max = max_area * max(area_scale, 0.5)

            if scaled_min < area < scaled_max:
                perimeter = cv2.arcLength(cnt, True)
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter ** 2)
                    # ULTRA STRICT: Higher circularity required (0.65 = very circular)
                    if circularity > 0.65:
                        # VERIFY contrast with surroundings
                        is_valid, cx, cy = verify_spot_contrast(cnt, "dark")
                        if is_valid:
                            blackhead_count += 1
                            acne_locations.append({
                                "x": round(cx, 3), "y": round(cy, 3),
                                "type": "blackhead",
                                "size": "small" if area < 60 else "medium"
                            })

        # Detect pimples with strict validation
        contours_red, _ = cv2.findContours(red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours_red:
            area = cv2.contourArea(cnt)
            if min_area * 1.5 * max(area_scale, 0.5) < area < max_area * 2 * max(area_scale, 0.5):
                perimeter = cv2.arcLength(cnt, True)
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter ** 2)
                    if circularity > 0.5:  # Higher circularity for pimples
                        # Verify it's actually red/inflamed, not just skin tone
                        spot_mask = np.zeros((h, w), dtype=np.uint8)
                        cv2.drawContours(spot_mask, [cnt], -1, 255, -1)
                        spot_hsv = hsv[spot_mask > 0]
                        if len(spot_hsv) > 0:
                            avg_saturation = np.mean(spot_hsv[:, 1])
                            # Must have VERY high saturation to be true inflammation
                            if avg_saturation > 110:  # Increased from 80
                                M = cv2.moments(cnt)
                                if M["m00"] > 0:
                                    cx = M["m10"] / M["m00"] / w
                                    cy = M["m01"] / M["m00"] / h
                                    pimple_count += 1
                                    acne_locations.append({
                                        "x": round(cx, 3), "y": round(cy, 3),
                                        "type": "pimple",
                                        "size": "small" if area < 120 else "large"
                                    })

        # Detect whiteheads with contrast verification
        _, thresh_bright = cv2.threshold(blurred, 215, 255, cv2.THRESH_BINARY)
        thresh_bright = cv2.bitwise_and(thresh_bright, mask)
        thresh_bright = cv2.morphologyEx(thresh_bright, cv2.MORPH_OPEN, kernel)

        contours_bright, _ = cv2.findContours(thresh_bright, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours_bright:
            area = cv2.contourArea(cnt)
            if min_area * max(area_scale, 0.5) < area < max_area * 0.7 * max(area_scale, 0.5):
                perimeter = cv2.arcLength(cnt, True)
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter ** 2)
                    if circularity > 0.55:  # Whiteheads are very circular
                        is_valid, cx, cy = verify_spot_contrast(cnt, "bright")
                        if is_valid:
                            whitehead_count += 1
                            acne_locations.append({
                                "x": round(cx, 3), "y": round(cy, 3),
                                "type": "whitehead", "size": "small"
                            })

        # Cap counts - LOWER caps to prevent over-detection
        blackhead_count = min(blackhead_count, 10)  # Reduced from 15
        pimple_count = min(pimple_count, 8)         # Reduced from 10
        whitehead_count = min(whitehead_count, 5)   # Reduced from 8

        # Calculate score - direct count mapping per IGA clinical scale
        # Weight: blackheads (1x), whiteheads (1x), pimples (2x - more severe)
        # IGA Grade mapping: 0=Clear, 1-10=Almost Clear, 11-25=Mild, 26-50=Moderate, 51+=Severe
        total_blemishes = blackhead_count + whitehead_count + pimple_count * 2
        acne_score = min(100, total_blemishes)  # Direct mapping - no artificial multiplier

        # Inflammation based on verified red pixels - STRICTER thresholds
        red_pixel_ratio = np.sum(red_mask > 0) / skin_area
        if red_pixel_ratio > 0.25:  # Increased from 0.15 - must be really red
            inflammation = 0.66
        elif red_pixel_ratio > 0.12:  # Increased from 0.06
            inflammation = 0.33
        else:
            inflammation = 0.0

        acne_locations = acne_locations[:15]

        return {
            "acne_score": int(acne_score),
            "whitehead_count": int(whitehead_count),
            "blackhead_count": int(blackhead_count),
            "pimple_count": int(pimple_count),
            "inflammation_level": float(inflammation),
            "acne_locations": acne_locations,
        }

    def _default_acne(self):
        """Return default acne values when detection fails"""
        return {
            "acne_score": 0,
            "whitehead_count": 0,
            "blackhead_count": 0,
            "pimple_count": 0,
            "inflammation_level": 0.0,
            "acne_locations": [],
        }

    def _detect_wrinkles(self, img: np.ndarray, mask: np.ndarray, face_data: Dict) -> Dict:
        """
        Detect wrinkles using improved multi-stage analysis.

        Improvements over basic Canny:
        1. Better noise reduction preserving wrinkle edges
        2. Direction-aware filtering (wrinkles are typically horizontal)
        3. Intensity-based filtering to ignore minor variations
        4. Regional analysis with appropriate thresholds
        5. Distinction between fine lines and deep wrinkles
        """

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # === Step 1: Advanced Preprocessing ===
        # CLAHE for better contrast in wrinkle regions
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Bilateral filter - preserves edges (wrinkles) while smoothing noise
        filtered = cv2.bilateralFilter(enhanced, 9, 75, 75)

        # Additional smoothing to reduce false positives from pores/texture
        smoothed = cv2.GaussianBlur(filtered, (3, 3), 0)

        # === Step 2: Multi-scale Edge Detection ===
        # Use higher thresholds to avoid detecting minor texture as wrinkles
        edges_fine = cv2.Canny(smoothed, 50, 120)     # Fine lines
        edges_deep = cv2.Canny(smoothed, 80, 180)    # Deep wrinkles only

        edges_fine = cv2.bitwise_and(edges_fine, mask)
        edges_deep = cv2.bitwise_and(edges_deep, mask)

        # === Step 3: Directional Filtering ===
        # Wrinkles tend to be horizontal or follow face contours
        # Filter out vertical edges (often facial features, not wrinkles)

        # Sobel for direction analysis
        sobel_x = cv2.Sobel(smoothed, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(smoothed, cv2.CV_64F, 0, 1, ksize=3)

        # Calculate gradient direction
        angle = np.arctan2(np.abs(sobel_y), np.abs(sobel_x)) * 180 / np.pi

        # Horizontal-ish edges (wrinkles) are 0-30 or 150-180 degrees
        horizontal_mask = ((angle < 35) | (angle > 145)).astype(np.uint8) * 255
        horizontal_mask = cv2.bitwise_and(horizontal_mask, mask)

        # Apply directional filter to edges
        wrinkle_edges = cv2.bitwise_and(edges_fine, horizontal_mask)

        # === Step 4: Laplacian for wrinkle depth estimation ===
        laplacian = cv2.Laplacian(smoothed, cv2.CV_64F)
        laplacian_abs = np.uint8(np.clip(np.absolute(laplacian), 0, 255))
        laplacian_masked = cv2.bitwise_and(laplacian_abs, mask)

        # === Step 5: Regional Analysis with MediaPipe Landmarks ===
        forehead_severity = 0.0
        crows_feet_severity = 0.0
        nasolabial_severity = 0.0
        regional_wrinkle_count = 0

        if face_data["type"] == "landmarks":
            landmarks = face_data["data"]

            def get_region_mask(region_indices):
                region_mask = np.zeros((h, w), dtype=np.uint8)
                points = []
                for idx in region_indices:
                    if idx < len(landmarks):
                        lm = landmarks[idx]
                        points.append([int(lm.x * w), int(lm.y * h)])
                if len(points) >= 3:
                    hull = cv2.convexHull(np.array(points, dtype=np.int32))
                    cv2.fillPoly(region_mask, [hull], 255)
                return region_mask

            def analyze_wrinkles_in_region(edge_img, lap_img, region_mask, min_length=8):
                """Analyze wrinkles in a specific region with quality filtering"""
                region_edges = cv2.bitwise_and(edge_img, region_mask)
                region_lap = cv2.bitwise_and(lap_img, region_mask)

                # Count high-confidence wrinkle lines
                lines = cv2.HoughLinesP(
                    region_edges, 1, np.pi / 180,
                    threshold=15,           # Require stronger evidence
                    minLineLength=min_length,  # Minimum length
                    maxLineGap=4           # Allow small gaps
                )

                if lines is None:
                    return 0, 0.0

                # Filter lines by orientation and intensity
                valid_lines = 0
                total_intensity = 0

                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    # Calculate angle
                    angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)

                    # For forehead, wrinkles are mostly horizontal (0-30 deg)
                    # For crow's feet, they radiate outward (30-60 deg)
                    # For nasolabial, they follow the fold (40-70 deg)

                    # Check intensity along the line
                    line_mask = np.zeros((h, w), dtype=np.uint8)
                    cv2.line(line_mask, (x1, y1), (x2, y2), 255, 2)
                    line_intensity = np.mean(region_lap[line_mask > 0]) if np.sum(line_mask > 0) > 0 else 0

                    # Valid wrinkle: moderate intensity, proper orientation
                    if line_intensity > 20:  # Must have some depth
                        valid_lines += 1
                        total_intensity += line_intensity

                avg_intensity = total_intensity / valid_lines if valid_lines > 0 else 0
                return valid_lines, avg_intensity

            # === Forehead Analysis ===
            forehead_mask = get_region_mask(self.FOREHEAD)
            forehead_lines, forehead_intensity = analyze_wrinkles_in_region(
                wrinkle_edges, laplacian_masked, forehead_mask, min_length=12
            )
            # Severity based on line count and intensity
            if forehead_lines >= 8 and forehead_intensity > 35:
                forehead_severity = 1.0   # Severe
            elif forehead_lines >= 4 and forehead_intensity > 25:
                forehead_severity = 0.66  # Moderate
            elif forehead_lines >= 2 or forehead_intensity > 20:
                forehead_severity = 0.33  # Mild
            else:
                forehead_severity = 0.0   # None

            regional_wrinkle_count += forehead_lines

            # === Crow's Feet Analysis ===
            left_cf_mask = get_region_mask(self.LEFT_CROWS_FEET)
            right_cf_mask = get_region_mask(self.RIGHT_CROWS_FEET)
            left_cf_lines, left_cf_int = analyze_wrinkles_in_region(
                edges_fine, laplacian_masked, left_cf_mask, min_length=6
            )
            right_cf_lines, right_cf_int = analyze_wrinkles_in_region(
                edges_fine, laplacian_masked, right_cf_mask, min_length=6
            )
            cf_lines = left_cf_lines + right_cf_lines
            cf_intensity = (left_cf_int + right_cf_int) / 2

            if cf_lines >= 10 and cf_intensity > 30:
                crows_feet_severity = 1.0
            elif cf_lines >= 5 and cf_intensity > 22:
                crows_feet_severity = 0.66
            elif cf_lines >= 2 or cf_intensity > 18:
                crows_feet_severity = 0.33
            else:
                crows_feet_severity = 0.0

            regional_wrinkle_count += cf_lines

            # === Nasolabial Fold Analysis ===
            left_nl_mask = get_region_mask(self.LEFT_NASOLABIAL)
            right_nl_mask = get_region_mask(self.RIGHT_NASOLABIAL)
            left_nl_lines, left_nl_int = analyze_wrinkles_in_region(
                edges_deep, laplacian_masked, left_nl_mask, min_length=10
            )
            right_nl_lines, right_nl_int = analyze_wrinkles_in_region(
                edges_deep, laplacian_masked, right_nl_mask, min_length=10
            )
            nl_lines = left_nl_lines + right_nl_lines
            nl_intensity = (left_nl_int + right_nl_int) / 2

            if nl_lines >= 4 and nl_intensity > 40:
                nasolabial_severity = 1.0
            elif nl_lines >= 2 and nl_intensity > 28:
                nasolabial_severity = 0.66
            elif nl_lines >= 1 or nl_intensity > 22:
                nasolabial_severity = 0.33
            else:
                nasolabial_severity = 0.0

            regional_wrinkle_count += nl_lines

        # === Step 6: Overall Wrinkle Metrics ===
        skin_pixels = laplacian_masked[mask > 0]

        if len(skin_pixels) > 0:
            # Fine lines: medium intensity gradients
            fine_line_pixels = np.sum((skin_pixels > 20) & (skin_pixels <= 50))
            deep_wrinkle_pixels = np.sum(skin_pixels > 50)

            skin_area = max(np.sum(mask > 0), 1)

            # Normalize by skin area
            fine_lines_count = min(35, int(fine_line_pixels / (skin_area * 0.003)))
            deep_wrinkles_count = min(12, int(deep_wrinkle_pixels / (skin_area * 0.006)))
        else:
            fine_lines_count = 0
            deep_wrinkles_count = 0

        # === Step 7: Calculate Overall Wrinkle Score ===
        # Weighted combination of all factors
        wrinkle_score = (
            (forehead_severity * 15) +
            (crows_feet_severity * 18) +
            (nasolabial_severity * 12) +
            (deep_wrinkles_count * 3) +
            (fine_lines_count * 0.4) +
            (regional_wrinkle_count * 0.8)
        )

        wrinkle_score = min(100, max(0, int(wrinkle_score)))

        # Build wrinkle regions with bounding boxes (normalized coordinates)
        wrinkle_regions = {
            "forehead": {
                "severity": float(forehead_severity),
                "bbox": [0.25, 0.08, 0.75, 0.22]  # top portion of face
            },
            "left_crows_feet": {
                "severity": float(crows_feet_severity),
                "bbox": [0.05, 0.25, 0.25, 0.42]  # outer left eye area
            },
            "right_crows_feet": {
                "severity": float(crows_feet_severity),
                "bbox": [0.75, 0.25, 0.95, 0.42]  # outer right eye area
            },
            "nasolabial": {
                "severity": float(nasolabial_severity),
                "bbox": [0.28, 0.50, 0.72, 0.78]  # nose-to-mouth folds
            }
        }

        return {
            "wrinkle_score": int(wrinkle_score),
            "fine_lines_count": int(fine_lines_count),
            "deep_wrinkles_count": int(deep_wrinkles_count),
            "forehead_lines_severity": float(forehead_severity),
            "crows_feet_severity": float(crows_feet_severity),
            "nasolabial_folds_severity": float(nasolabial_severity),
            "wrinkle_regions": wrinkle_regions,
        }

    def _analyze_texture(self, img: np.ndarray, mask: np.ndarray) -> Dict:
        """Analyze skin texture using variance and gradient analysis"""

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray_masked = gray.copy()
        gray_masked[mask == 0] = 0

        # Calculate local variance (indicates texture roughness)
        kernel_size = 5
        mean = cv2.blur(gray_masked.astype(np.float32), (kernel_size, kernel_size))
        sqr_mean = cv2.blur(gray_masked.astype(np.float32) ** 2, (kernel_size, kernel_size))
        variance = sqr_mean - mean ** 2
        variance[mask == 0] = 0

        # Get variance statistics
        skin_variance = variance[mask > 0]
        mean_variance = np.mean(skin_variance) if len(skin_variance) > 0 else 0

        # Pore detection using Laplacian of Gaussian
        blurred = cv2.GaussianBlur(gray_masked, (3, 3), 0)
        log = cv2.Laplacian(blurred, cv2.CV_64F)
        log = np.uint8(np.absolute(log))

        _, pore_mask = cv2.threshold(log, 25, 255, cv2.THRESH_BINARY)
        pore_mask = cv2.bitwise_and(pore_mask, mask)

        # Count and measure pores
        contours, _ = cv2.findContours(pore_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        h, w = gray.shape

        pore_sizes = []
        enlarged_pores = 0
        enlarged_pores_locations = []  # Store locations of enlarged pores
        skin_area = max(np.sum(mask > 0), 1)
        area_scale = skin_area / 100000

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 3 * max(area_scale, 0.5) < area < 80 * max(area_scale, 0.5):
                pore_sizes.append(area)
                if area > 25 * max(area_scale, 0.5):
                    enlarged_pores += 1
                    # Get centroid for enlarged pores only
                    M = cv2.moments(cnt)
                    if M["m00"] > 0 and len(enlarged_pores_locations) < 15:
                        cx = M["m10"] / M["m00"] / w
                        cy = M["m01"] / M["m00"] / h
                        enlarged_pores_locations.append({
                            "x": round(cx, 3),
                            "y": round(cy, 3)
                        })

        enlarged_pores = min(enlarged_pores, 50)

        # Classify pore size (as float 0.0-1.0 for database, represents mm)
        if pore_sizes:
            avg_pore_area = float(np.mean(pore_sizes))
            # Convert area to approximate mm (normalized)
            pore_size = min(1.0, avg_pore_area / 30.0)  # 30 px² → ~1mm
        else:
            pore_size = 0.1  # small default

        # Determine roughness level (0.0-1.0 scale for database)
        if mean_variance > 400:
            roughness = 1.0  # rough
        elif mean_variance > 150:
            roughness = 0.5  # slightly_rough
        else:
            roughness = 0.0  # smooth

        # Calculate texture score (higher = smoother)
        smoothness_score = max(0, min(100, 100 - int(mean_variance / 4)))
        texture_score = max(0, min(100, smoothness_score - (enlarged_pores)))

        return {
            "texture_score": int(texture_score),
            "pore_size_average": float(pore_size),
            "enlarged_pores_count": int(enlarged_pores),
            "roughness_level": float(roughness),
            "smoothness_score": int(smoothness_score),
            "enlarged_pores_locations": enlarged_pores_locations,
            # T-zone region for pores highlight
            "pores_region": {
                "bbox": [0.35, 0.15, 0.65, 0.75]  # nose/forehead/chin T-zone
            }
        }

    def _analyze_redness(self, img: np.ndarray, mask: np.ndarray) -> Dict:
        """Analyze skin redness with HIGH ACCURACY validation.

        STRICT ACCURACY MODE:
        - Compare to individual's skin tone baseline
        - Verify redness is abnormal, not natural undertone
        - Use LAB color space for better red detection
        - Only flag clinically significant redness
        """

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        hsv_pixels = hsv[mask > 0]
        lab_pixels = lab[mask > 0]

        if len(hsv_pixels) == 0:
            return self._default_redness()

        h_channel = hsv_pixels[:, 0]
        s_channel = hsv_pixels[:, 1]
        v_channel = hsv_pixels[:, 2]
        a_channel = lab_pixels[:, 1]  # LAB 'a' channel: negative=green, positive=red
        total_pixels = len(h_channel)

        # Calculate baseline skin tone
        median_saturation = np.median(s_channel)
        median_a = np.median(a_channel)  # Baseline red-green axis

        # ULTRA STRICT: Only count pixels EXTREMELY redder than person's baseline
        # Using LAB 'a' channel which better captures red vs non-red
        # Increased threshold from 20 to 35 - must be VERY obviously redder than baseline
        red_threshold_a = median_a + 35  # Much higher threshold for true redness
        abnormal_red_pixels = np.sum(a_channel > red_threshold_a)
        abnormal_red_ratio = abnormal_red_pixels / total_pixels

        # HSV-based red with ULTRA STRICT thresholds
        # Very narrow hue range AND very high saturation AND brightness check
        strict_red = np.sum(
            ((h_channel < 5) | (h_channel > 175)) &  # Very narrow hue range
            (s_channel > 130) &  # Very high saturation - only true inflammation
            (v_channel > 70)
        )
        strict_red_ratio = strict_red / total_pixels

        # Intense inflammation: extreme saturation red only
        intense_red = np.sum(
            ((h_channel < 4) | (h_channel > 176)) &  # Extremely narrow hue
            (s_channel > 150)  # Only very obvious inflammation
        )
        intense_ratio = intense_red / total_pixels

        # Account for natural skin undertone - GENEROUS baseline subtraction
        # Warm skin tones (common in Indian population) naturally have higher redness
        natural_baseline = min(0.35, median_saturation / 300)  # More generous for warm undertones
        adjusted_red_ratio = max(0, strict_red_ratio - natural_baseline)
        adjusted_abnormal_ratio = max(0, abnormal_red_ratio - 0.15)  # 15% is normal variation (was 5%)

        # SAFETY: If most of the face appears "red", it's likely natural skin tone
        # Cap the ratios to prevent natural warm skin from scoring high
        if abnormal_red_ratio > 0.5:  # More than 50% "abnormal" = probably just natural tone
            adjusted_abnormal_ratio = min(adjusted_abnormal_ratio, 0.10)
        if strict_red_ratio > 0.3:  # More than 30% "red" = probably just warm undertone
            adjusted_red_ratio = min(adjusted_red_ratio, 0.08)

        # Calculate redness score - LOWER multipliers to reduce false positives
        redness_score = min(100, int(
            adjusted_abnormal_ratio * 50 +  # Reduced from 80 - LAB-based abnormal redness
            adjusted_red_ratio * 30 +        # Reduced from 40 - HSV-based strict redness
            intense_ratio * 100              # Reduced from 150 - Intense inflammation
        ))

        # Determine sensitivity level - STRICT thresholds
        if intense_ratio > 0.10 or adjusted_abnormal_ratio > 0.15:
            sensitivity = "high"
        elif intense_ratio > 0.04 or adjusted_abnormal_ratio > 0.08:
            sensitivity = "medium"
        else:
            sensitivity = "low"

        # Check for irritation patterns
        red_binary = np.zeros_like(mask)
        hsv_full = hsv.copy()
        red_binary[((hsv_full[:, :, 0] < 8) | (hsv_full[:, :, 0] > 172)) &
                   (hsv_full[:, :, 1] > 90) & (mask > 0)] = 255

        # Morphological cleanup
        kernel = np.ones((3, 3), np.uint8)
        red_binary = cv2.morphologyEx(red_binary, cv2.MORPH_OPEN, kernel)

        num_labels, _ = cv2.connectedComponents(red_binary)
        irritation_detected = bool((num_labels - 1) > 10)

        # Rosacea indicators - STRICT: requires multiple strong signals
        rosacea_indicators = bool(
            intense_ratio > 0.12 and
            adjusted_abnormal_ratio > 0.20 and
            adjusted_red_ratio > 0.15
        )

        # Build redness regions - only for significant redness
        redness_regions = []
        if adjusted_red_ratio > 0.15 or adjusted_abnormal_ratio > 0.12:
            redness_regions.append({
                "region": "cheeks",
                "bbox": [0.10, 0.35, 0.40, 0.65],
                "intensity": round(max(adjusted_red_ratio, adjusted_abnormal_ratio), 2)
            })
            redness_regions.append({
                "region": "cheeks",
                "bbox": [0.60, 0.35, 0.90, 0.65],
                "intensity": round(max(adjusted_red_ratio, adjusted_abnormal_ratio), 2)
            })
        if intense_ratio > 0.06:
            redness_regions.append({
                "region": "nose",
                "bbox": [0.38, 0.40, 0.62, 0.70],
                "intensity": round(intense_ratio, 2)
            })

        return {
            "redness_score": int(redness_score),
            "sensitivity_level": sensitivity,
            "irritation_detected": irritation_detected,
            "rosacea_indicators": rosacea_indicators,
            "redness_regions": redness_regions,
        }

    def _analyze_hydration(self, img: np.ndarray, mask: np.ndarray, face_data: Dict) -> Dict:
        """Analyze skin hydration and oiliness using brightness analysis"""

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        h, w = img.shape[:2]

        # Brightness statistics
        skin_brightness = l_channel[mask > 0]
        if len(skin_brightness) == 0:
            return self._default_hydration()

        mean_brightness = np.mean(skin_brightness)
        brightness_std = np.std(skin_brightness)

        # Detect shiny areas (specular highlights)
        _, shine_mask = cv2.threshold(l_channel, 210, 255, cv2.THRESH_BINARY)
        shine_mask = cv2.bitwise_and(shine_mask, mask)
        skin_area = max(np.sum(mask > 0), 1)
        shine_ratio = np.sum(shine_mask > 0) / skin_area

        # T-zone analysis
        t_zone_mean = mean_brightness
        t_zone_shine = shine_ratio

        if face_data["type"] == "landmarks":
            landmarks = face_data["data"]
            t_zone_mask = np.zeros((h, w), dtype=np.uint8)
            t_zone_points = []
            for idx in self.T_ZONE[:30]:
                if idx < len(landmarks):
                    lm = landmarks[idx]
                    t_zone_points.append([int(lm.x * w), int(lm.y * h)])

            if len(t_zone_points) >= 3:
                hull = cv2.convexHull(np.array(t_zone_points, dtype=np.int32))
                cv2.fillPoly(t_zone_mask, [hull], 255)
                t_zone_combined = cv2.bitwise_and(t_zone_mask, mask)
                t_zone_brightness = l_channel[t_zone_combined > 0]
                t_zone_mean = np.mean(t_zone_brightness) if len(t_zone_brightness) > 0 else mean_brightness
                t_zone_shine = np.sum((shine_mask > 0) & (t_zone_combined > 0)) / max(np.sum(t_zone_combined > 0), 1)

        elif face_data["type"] == "bbox":
            # Estimate T-zone from bounding box
            x, y, fw, fh = face_data["data"]
            t_zone_mask = np.zeros((h, w), dtype=np.uint8)
            # Forehead (top center)
            cv2.rectangle(t_zone_mask, (x + fw // 4, y), (x + 3 * fw // 4, y + fh // 3), 255, -1)
            # Nose (center)
            cv2.rectangle(t_zone_mask, (x + fw // 3, y + fh // 4), (x + 2 * fw // 3, y + 2 * fh // 3), 255, -1)
            t_zone_combined = cv2.bitwise_and(t_zone_mask, mask)
            t_zone_brightness = l_channel[t_zone_combined > 0]
            if len(t_zone_brightness) > 0:
                t_zone_mean = np.mean(t_zone_brightness)
                t_zone_shine = np.sum((shine_mask > 0) & (t_zone_combined > 0)) / max(np.sum(t_zone_combined > 0), 1)

        # T-zone oiliness (0.0-1.0 scale for database)
        if t_zone_shine > 0.12:
            t_zone_oiliness = 1.0  # high
        elif t_zone_shine > 0.04:
            t_zone_oiliness = 0.5  # normal
        else:
            t_zone_oiliness = 0.0  # low

        # Oiliness score
        oiliness_score = min(100, int(shine_ratio * 180 + brightness_std / 3))

        # Hydration score - no artificial floor, let true dryness show
        if shine_ratio < 0.02 and mean_brightness < 140:
            hydration_score = int(max(0, min(100, 55 - int(brightness_std / 2))))  # Can go below 30 for truly dry skin
            dry_patches = True
        else:
            hydration_score = int(min(100, 65 + int(shine_ratio * 60)))
            dry_patches = bool(shine_ratio < 0.01)

        # Determine hydration level
        cheek_diff = abs(mean_brightness - t_zone_mean)
        if hydration_score < 45:
            hydration_level = "dry"
        elif oiliness_score > 55 and cheek_diff > 15:
            hydration_level = "combination"
        elif oiliness_score > 50:
            hydration_level = "oily"
        else:
            hydration_level = "normal"

        return {
            "hydration_score": int(hydration_score),
            "hydration_level": hydration_level,
            "oiliness_score": int(oiliness_score),
            "t_zone_oiliness": float(t_zone_oiliness),
            "dry_patches_detected": dry_patches,
        }

    def _detect_pigmentation(self, img: np.ndarray, mask: np.ndarray) -> Dict:
        """Detect pigmentation with HIGH ACCURACY contrast validation.

        STRICT ACCURACY MODE:
        - Each spot must have significant contrast vs surroundings
        - Verify spots are true pigmentation, not shadows
        - Use local neighborhood comparison
        - Only count validated dark spots
        """

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        a_channel = lab[:, :, 1]  # For color-based validation
        h, w = l_channel.shape

        skin_lightness = l_channel[mask > 0]
        if len(skin_lightness) == 0:
            return self._default_pigmentation()

        mean_lightness = np.mean(skin_lightness)
        std_lightness = np.std(skin_lightness)
        median_lightness = np.median(skin_lightness)

        # STRICT: Use 2.0 std for initial detection, then validate
        dark_threshold = mean_lightness - 2.0 * std_lightness
        dark_threshold = max(dark_threshold, mean_lightness * 0.65)

        dark_mask = (l_channel < dark_threshold).astype(np.uint8) * 255
        dark_mask = cv2.bitwise_and(dark_mask, mask)

        # Strong morphological cleanup
        kernel = np.ones((3, 3), np.uint8)
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel)
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(dark_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        dark_spots_count = 0
        total_dark_area = 0
        dark_spots_locations = []
        skin_area = max(np.sum(mask > 0), 1)
        area_scale = skin_area / 100000

        # STRICT: Higher minimum area
        min_area = 25
        max_area = 1200

        def verify_pigmentation_spot(cnt):
            """Verify spot is true pigmentation with contrast validation"""
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                return False, 0

            # Get spot intensity
            spot_mask = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(spot_mask, [cnt], -1, 255, -1)
            spot_pixels = l_channel[spot_mask > 0]

            if len(spot_pixels) < 5:
                return False, 0

            spot_mean = np.mean(spot_pixels)

            # Get surrounding area (dilate contour)
            dilated = cv2.dilate(spot_mask, kernel, iterations=4)
            surround_mask = cv2.subtract(dilated, spot_mask)
            surround_mask = cv2.bitwise_and(surround_mask, mask)
            surround_pixels = l_channel[surround_mask > 0]

            if len(surround_pixels) < 20:
                return False, 0

            surround_mean = np.mean(surround_pixels)

            # STRICT: Spot must be at least 12 units darker than immediate surroundings
            contrast = surround_mean - spot_mean
            if contrast < 12:
                return False, 0

            # Additional check: spot should also be darker than global median
            if spot_mean > median_lightness - 5:
                return False, 0

            return True, contrast

        large_patches = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            scaled_min = min_area * max(area_scale, 0.5)
            scaled_max = max_area * max(area_scale, 0.5)

            if scaled_min < area < scaled_max:
                # VERIFY this is true pigmentation
                is_valid, contrast = verify_pigmentation_spot(cnt)

                if is_valid:
                    dark_spots_count += 1
                    total_dark_area += area

                    if area > 400 * max(area_scale, 0.5):
                        large_patches += 1

                    M = cv2.moments(cnt)
                    if M["m00"] > 0 and len(dark_spots_locations) < 10:
                        cx = M["m10"] / M["m00"] / w
                        cy = M["m01"] / M["m00"] / h
                        dark_spots_locations.append({
                            "x": round(cx, 3),
                            "y": round(cy, 3),
                            "size": round(area / skin_area * 1000, 3),
                            "contrast": round(contrast, 1)
                        })

        dark_spots_count = min(dark_spots_count, 20)

        # Pigmentation score - based on VERIFIED spots only
        dark_ratio = total_dark_area / skin_area
        pigmentation_score = min(100, int(dark_ratio * 400 + dark_spots_count * 3.0))

        # Severity classification - STRICT thresholds
        if dark_spots_count > 12 or dark_ratio > 0.08:
            severity = 1.0  # severe
        elif dark_spots_count > 6 or dark_ratio > 0.04:
            severity = 0.66  # moderate
        elif dark_spots_count > 2:
            severity = 0.33  # mild
        else:
            severity = 0.0  # none

        # Sun damage score
        sun_damage_score = int(min(100, int(std_lightness * 1.8 + dark_spots_count * 1.5)))

        # Melasma detection - requires multiple large verified patches
        melasma_detected = bool(large_patches >= 2)

        return {
            "pigmentation_score": int(pigmentation_score),
            "dark_spots_count": int(dark_spots_count),
            "dark_spots_severity": float(severity),
            "sun_damage_score": sun_damage_score,
            "melasma_detected": melasma_detected,
            "dark_spots_locations": dark_spots_locations,
        }

    def _detect_dark_circles(self, img: np.ndarray, mask: np.ndarray, face_data: Dict) -> Dict:
        """
        Detect dark circles under the eyes using multiple methods:
        1. LAB color space L-channel (luminance) analysis
        2. Comparison to cheek/face brightness
        3. Histogram-based darkness detection
        4. Color analysis (bluish/purple tones indicate dark circles)

        Returns:
            Dictionary with dark_circles_score, severity for each eye, and region coords
        """
        try:
            h, w = img.shape[:2]
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l_channel = lab[:, :, 0]
            a_channel = lab[:, :, 1]  # Red-green axis (for bluish tones)
            b_channel = lab[:, :, 2]  # Yellow-blue axis

            # NOTE: Landmarks are stored under "data" key, not "landmarks"
            landmarks = face_data.get("data", [])

            # If no landmarks, use fallback method based on face region estimation
            if not landmarks:
                print("[Dark Circles] No landmarks available, using fallback detection")
                return self._detect_dark_circles_fallback(img, mask, l_channel, h, w)

            def get_region_mask_and_bbox(region_indices):
                """Create mask and get bounding box for a region"""
                points = []
                for idx in region_indices:
                    if idx < len(landmarks):
                        lm = landmarks[idx]
                        x, y = int(lm.x * w), int(lm.y * h)
                        points.append([x, y])

                if len(points) < 3:
                    return None, None

                points = np.array(points, dtype=np.int32)
                region_mask = np.zeros((h, w), dtype=np.uint8)
                cv2.fillConvexPoly(region_mask, points, 255)

                # Get normalized bounding box
                x_coords = [p[0] / w for p in points]
                y_coords = [p[1] / h for p in points]
                bbox = [min(x_coords), min(y_coords), max(x_coords), max(y_coords)]

                return region_mask, bbox

            # Analyze left under-eye
            left_mask, left_bbox = get_region_mask_and_bbox(self.LEFT_UNDER_EYE)
            left_darkness = 0.0
            left_blue_tone = 0.0
            if left_mask is not None:
                left_l_pixels = l_channel[left_mask > 0]
                left_b_pixels = b_channel[left_mask > 0]
                if len(left_l_pixels) > 0:
                    left_darkness = 255 - np.mean(left_l_pixels)  # Invert: higher = darker
                    # Check for blue/purple tones (lower b_channel = more blue)
                    left_blue_tone = max(0, 128 - np.mean(left_b_pixels)) / 40

            # Analyze right under-eye
            right_mask, right_bbox = get_region_mask_and_bbox(self.RIGHT_UNDER_EYE)
            right_darkness = 0.0
            right_blue_tone = 0.0
            if right_mask is not None:
                right_l_pixels = l_channel[right_mask > 0]
                right_b_pixels = b_channel[right_mask > 0]
                if len(right_l_pixels) > 0:
                    right_darkness = 255 - np.mean(right_l_pixels)
                    right_blue_tone = max(0, 128 - np.mean(right_b_pixels)) / 40

            # Get cheek brightness as reference
            left_cheek_mask, _ = get_region_mask_and_bbox(self.LEFT_CHEEK)
            right_cheek_mask, _ = get_region_mask_and_bbox(self.RIGHT_CHEEK)
            cheek_brightness = 128  # default
            if left_cheek_mask is not None and right_cheek_mask is not None:
                cheek_mask = cv2.bitwise_or(left_cheek_mask, right_cheek_mask)
                cheek_pixels = l_channel[cheek_mask > 0]
                if len(cheek_pixels) > 0:
                    cheek_brightness = 255 - np.mean(cheek_pixels)

            # Get forehead brightness (often lighter, good reference)
            forehead_mask, _ = get_region_mask_and_bbox(self.FOREHEAD)
            forehead_brightness = cheek_brightness
            if forehead_mask is not None:
                forehead_pixels = l_channel[forehead_mask > 0]
                if len(forehead_pixels) > 0:
                    forehead_brightness = 255 - np.mean(forehead_pixels)

            # Face average for reference
            face_pixels = l_channel[mask > 0]
            face_avg_darkness = 255 - np.mean(face_pixels) if len(face_pixels) > 0 else 128

            # Calculate dark circle severity - EXTREMELY SENSITIVE detection
            print(f"[Dark Circles Debug] Left darkness: {left_darkness:.1f}, Right: {right_darkness:.1f}, Cheek: {cheek_brightness:.1f}, Face: {face_avg_darkness:.1f}")
            print(f"[Dark Circles Debug] Left blue: {left_blue_tone:.2f}, Right blue: {right_blue_tone:.2f}")

            # === Method 1: Relative comparison to cheeks ===
            # RECALIBRATED: Diff of 40+ = severe, 30 = moderate, 20 = mild, <10 = none
            left_vs_cheek = max(0, (left_darkness - cheek_brightness) / 40)  # Was /15, now /40
            right_vs_cheek = max(0, (right_darkness - cheek_brightness) / 40)

            # === Method 2: Relative to forehead ===
            # RECALIBRATED: Forehead comparison with reasonable scaling
            left_vs_forehead = max(0, (left_darkness - forehead_brightness) / 45)  # Was /18, now /45
            right_vs_forehead = max(0, (right_darkness - forehead_brightness) / 45)

            # === Method 3: Absolute darkness threshold ===
            # RECALIBRATED: Only flag truly dark under-eye areas
            left_absolute = max(0, (left_darkness - 100) / 60) if left_darkness > 100 else 0  # Was 85/50, now 100/60
            right_absolute = max(0, (right_darkness - 100) / 60) if right_darkness > 100 else 0

            # === Method 4: Compare to face average ===
            # RECALIBRATED: Reasonable face comparison
            left_vs_face = max(0, (left_darkness - face_avg_darkness) / 40)  # Was /20, now /40
            right_vs_face = max(0, (right_darkness - face_avg_darkness) / 40)

            # === Method 5: Blue/purple tone detection ===
            # Dark circles often have bluish undertones
            left_color_score = left_blue_tone * 0.8
            right_color_score = right_blue_tone * 0.8

            # === Method 6: Percentile-based detection ===
            # Check if under-eye is in the darkest percentile of face
            if len(face_pixels) > 100:
                dark_threshold = np.percentile(255 - face_pixels, 75)  # 75th percentile of darkness
                left_percentile = 0.3 if left_darkness > dark_threshold else 0
                right_percentile = 0.3 if right_darkness > dark_threshold else 0
            else:
                left_percentile = 0
                right_percentile = 0

            print(f"[Dark Circles Debug] Methods - vs_cheek: {left_vs_cheek:.2f}/{right_vs_cheek:.2f}, vs_forehead: {left_vs_forehead:.2f}/{right_vs_forehead:.2f}")
            print(f"[Dark Circles Debug] Absolute: {left_absolute:.2f}/{right_absolute:.2f}, vs_face: {left_vs_face:.2f}/{right_vs_face:.2f}, color: {left_color_score:.2f}/{right_color_score:.2f}")

            # Combine ALL methods - take the MAXIMUM to catch dark circles from any angle
            left_severity = max(
                left_vs_cheek,
                left_vs_forehead,
                left_absolute,
                left_vs_face,
                left_color_score,
                left_percentile
            )
            right_severity = max(
                right_vs_cheek,
                right_vs_forehead,
                right_absolute,
                right_vs_face,
                right_color_score,
                right_percentile
            )

            # No artificial floor boosts - let actual detection methods determine severity
            # Removed all minimum thresholds that were artificially inflating scores

            # Clamp to 0-1 range
            left_severity = min(1.0, left_severity)
            right_severity = min(1.0, right_severity)

            # Overall score (0-100, higher = worse dark circles)
            avg_severity = (left_severity + right_severity) / 2
            # Direct mapping without aggressive boost - let raw detection speak
            # Per POH Scale: Grade 1 (10-25), Grade 2 (25-45), Grade 3 (45-65), Grade 4 (65+)
            dark_circles_score = min(100, int(avg_severity * 100))  # No multiplier - true ML value

            print(f"[Dark Circles Debug] Final score: {dark_circles_score}, Left: {left_severity:.2f}, Right: {right_severity:.2f}")

            return {
                "dark_circles_score": dark_circles_score,
                "dark_circles_left_severity": round(left_severity, 2),
                "dark_circles_right_severity": round(right_severity, 2),
                "dark_circles_regions": {
                    "left_eye": {"bbox": left_bbox, "severity": round(left_severity, 2)} if left_bbox else None,
                    "right_eye": {"bbox": right_bbox, "severity": round(right_severity, 2)} if right_bbox else None,
                }
            }

        except Exception as e:
            print(f"Dark circles detection error: {e}")
            return self._default_dark_circles()

    def _detect_dark_circles_fallback(self, img: np.ndarray, mask: np.ndarray, l_channel: np.ndarray, h: int, w: int) -> Dict:
        """
        Fallback dark circles detection when face landmarks are not available.
        Uses face region estimation based on the mask to locate under-eye areas.
        """
        try:
            # Find face bounding box from mask
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return self._default_dark_circles()

            # Get largest contour (face)
            face_contour = max(contours, key=cv2.contourArea)
            x, y, fw, fh = cv2.boundingRect(face_contour)

            # Estimate under-eye regions based on typical face proportions
            # Under-eye area is typically 25-35% down from top of face, 15-40% from center
            eye_y_start = y + int(fh * 0.28)
            eye_y_end = y + int(fh * 0.38)

            left_eye_x_start = x + int(fw * 0.15)
            left_eye_x_end = x + int(fw * 0.40)

            right_eye_x_start = x + int(fw * 0.60)
            right_eye_x_end = x + int(fw * 0.85)

            # Cheek reference area (below eyes)
            cheek_y_start = y + int(fh * 0.40)
            cheek_y_end = y + int(fh * 0.55)

            # Create masks for estimated regions
            left_eye_mask = np.zeros((h, w), dtype=np.uint8)
            right_eye_mask = np.zeros((h, w), dtype=np.uint8)
            cheek_mask = np.zeros((h, w), dtype=np.uint8)

            cv2.rectangle(left_eye_mask, (left_eye_x_start, eye_y_start), (left_eye_x_end, eye_y_end), 255, -1)
            cv2.rectangle(right_eye_mask, (right_eye_x_start, eye_y_start), (right_eye_x_end, eye_y_end), 255, -1)
            cv2.rectangle(cheek_mask, (x + int(fw * 0.2), cheek_y_start), (x + int(fw * 0.8), cheek_y_end), 255, -1)

            # Apply face mask to ensure we're within the face
            left_eye_mask = cv2.bitwise_and(left_eye_mask, mask)
            right_eye_mask = cv2.bitwise_and(right_eye_mask, mask)
            cheek_mask = cv2.bitwise_and(cheek_mask, mask)

            # Calculate darkness values
            left_pixels = l_channel[left_eye_mask > 0]
            right_pixels = l_channel[right_eye_mask > 0]
            cheek_pixels = l_channel[cheek_mask > 0]

            left_darkness = 255 - np.mean(left_pixels) if len(left_pixels) > 0 else 0
            right_darkness = 255 - np.mean(right_pixels) if len(right_pixels) > 0 else 0
            cheek_brightness = 255 - np.mean(cheek_pixels) if len(cheek_pixels) > 0 else 128

            print(f"[Dark Circles Fallback] Left: {left_darkness:.1f}, Right: {right_darkness:.1f}, Cheek: {cheek_brightness:.1f}")

            # Calculate severity using RECALIBRATED logic (matching main method)
            left_vs_cheek = max(0, (left_darkness - cheek_brightness) / 40)  # Was /15, now /40
            right_vs_cheek = max(0, (right_darkness - cheek_brightness) / 40)

            left_absolute = max(0, (left_darkness - 100) / 60) if left_darkness > 100 else 0  # Was 85/50, now 100/60
            right_absolute = max(0, (right_darkness - 100) / 60) if right_darkness > 100 else 0

            left_severity = max(left_vs_cheek, left_absolute)
            right_severity = max(right_vs_cheek, right_absolute)

            # No artificial floor boosts - let detection methods determine severity

            left_severity = min(1.0, left_severity)
            right_severity = min(1.0, right_severity)

            avg_severity = (left_severity + right_severity) / 2
            # Direct mapping - no aggressive multiplier
            dark_circles_score = min(100, int(avg_severity * 100))

            # Bounding boxes normalized
            left_bbox = [left_eye_x_start / w, eye_y_start / h, left_eye_x_end / w, eye_y_end / h]
            right_bbox = [right_eye_x_start / w, eye_y_start / h, right_eye_x_end / w, eye_y_end / h]

            print(f"[Dark Circles Fallback] Final score: {dark_circles_score}")

            return {
                "dark_circles_score": dark_circles_score,
                "dark_circles_left_severity": round(left_severity, 2),
                "dark_circles_right_severity": round(right_severity, 2),
                "dark_circles_regions": {
                    "left_eye": {"bbox": left_bbox, "severity": round(left_severity, 2)},
                    "right_eye": {"bbox": right_bbox, "severity": round(right_severity, 2)},
                },
                "_detection_method": "fallback"
            }

        except Exception as e:
            print(f"[Dark Circles Fallback] Error: {e}")
            return self._default_dark_circles()

    def _estimate_skin_age(self, analysis: Dict) -> Dict:
        """
        Estimate skin age based on comprehensive multi-factor analysis.

        Uses a weighted scoring system that considers:
        - Wrinkle presence and severity (most predictive)
        - Skin texture and elasticity indicators
        - Pigmentation and sun damage
        - Hydration and overall skin health
        - Regional analysis (forehead, crow's feet, nasolabial)
        """

        # Start with a neutral score (50 = average for all ages)
        age_score = 50.0

        # === Factor 1: Wrinkle Analysis (40% weight) ===
        wrinkle_score = analysis.get("wrinkle_score", 15)
        fine_lines = analysis.get("fine_lines_count", 0)
        deep_wrinkles = analysis.get("deep_wrinkles_count", 0)

        # Regional wrinkle severity (0.0-1.0 scale)
        forehead_severity = analysis.get("forehead_lines_severity", 0.0)
        crows_feet_severity = analysis.get("crows_feet_severity", 0.0)
        nasolabial_severity = analysis.get("nasolabial_folds_severity", 0.0)

        # Deep wrinkles are strongest age indicator
        wrinkle_age_factor = (
            (deep_wrinkles * 4.0) +  # Each deep wrinkle adds ~4 years
            (fine_lines * 0.8) +      # Fine lines add less
            (wrinkle_score * 0.3) +   # Overall score contribution
            (forehead_severity * 12) +    # Forehead lines appear 35+
            (crows_feet_severity * 15) +  # Crow's feet appear 40+
            (nasolabial_severity * 10)    # Nasolabial folds appear 30+
        )

        # Normalize to 0-50 range
        wrinkle_contribution = min(50, wrinkle_age_factor)

        # === Factor 2: Texture & Elasticity (25% weight) ===
        texture_score = analysis.get("texture_score", 70)
        smoothness = analysis.get("smoothness_score", 70)
        enlarged_pores = analysis.get("enlarged_pores_count", 0)
        roughness = analysis.get("roughness_level", 0.0)

        # Lower texture scores indicate aging
        # texture_score 100 = young, 50 = middle-aged, 20 = older
        texture_age_factor = (100 - texture_score) * 0.3
        texture_age_factor += (100 - smoothness) * 0.15
        texture_age_factor += min(enlarged_pores * 0.5, 8)  # Pores enlarge with age
        texture_age_factor += roughness * 10  # Rougher skin indicates aging

        texture_contribution = min(30, texture_age_factor)

        # === Factor 3: Pigmentation & Sun Damage (20% weight) ===
        pigmentation = analysis.get("pigmentation_score", 15)
        dark_spots = analysis.get("dark_spots_count", 0)
        sun_damage = analysis.get("sun_damage_score", 10)
        melasma = analysis.get("melasma_detected", False)

        # Sun damage and pigmentation accumulate with age
        pigment_age_factor = (
            (dark_spots * 1.5) +       # Each spot adds ~1.5 years appearance
            (pigmentation * 0.2) +
            (sun_damage * 0.15) +
            (8 if melasma else 0)      # Melasma typically appears 30+
        )

        pigment_contribution = min(25, pigment_age_factor)

        # === Factor 4: Hydration & Skin Health (15% weight) ===
        hydration = analysis.get("hydration_score", 65)
        oiliness = analysis.get("oiliness_score", 40)
        dry_patches = analysis.get("dry_patches_detected", False)

        # Skin tends to get drier with age, but oiliness varies
        hydration_age_factor = 0
        if hydration < 40:  # Very dry skin
            hydration_age_factor += 8
        elif hydration < 55:  # Dry skin
            hydration_age_factor += 4
        elif hydration > 85:  # Very hydrated (youthful)
            hydration_age_factor -= 3

        if dry_patches:
            hydration_age_factor += 5

        # High oiliness can indicate younger skin
        if oiliness > 70:
            hydration_age_factor -= 3
        elif oiliness < 25:
            hydration_age_factor += 2

        hydration_contribution = max(-5, min(15, hydration_age_factor))

        # === Factor 5: Acne & Inflammation (negative correlation with age) ===
        acne_score = analysis.get("acne_score", 10)
        pimple_count = analysis.get("pimple_count", 0)

        # Active acne more common in younger people
        if acne_score > 50 or pimple_count > 5:
            acne_adjustment = -5  # Suggests younger skin
        elif acne_score < 10 and pimple_count == 0:
            acne_adjustment = 2   # Very clear skin could be any age
        else:
            acne_adjustment = 0

        # === Calculate Final Age ===
        # Combine all factors
        total_age_factor = (
            wrinkle_contribution * 0.40 +
            texture_contribution * 0.25 +
            pigment_contribution * 0.20 +
            hydration_contribution * 0.15 +
            acne_adjustment
        )

        # Map score to age range
        # Score 0-10: Ages 15-22 (very youthful skin)
        # Score 10-25: Ages 22-30 (young adult)
        # Score 25-40: Ages 30-40 (early middle age)
        # Score 40-55: Ages 40-50 (middle age)
        # Score 55-70: Ages 50-60 (mature skin)
        # Score 70+: Ages 60+ (aged skin)

        if total_age_factor < 10:
            estimated_age = 15 + (total_age_factor * 0.7)  # 15-22
        elif total_age_factor < 25:
            estimated_age = 22 + ((total_age_factor - 10) * 0.53)  # 22-30
        elif total_age_factor < 40:
            estimated_age = 30 + ((total_age_factor - 25) * 0.67)  # 30-40
        elif total_age_factor < 55:
            estimated_age = 40 + ((total_age_factor - 40) * 0.67)  # 40-50
        elif total_age_factor < 70:
            estimated_age = 50 + ((total_age_factor - 55) * 0.67)  # 50-60
        else:
            estimated_age = 60 + min((total_age_factor - 70) * 0.5, 25)  # 60-85

        # Round to nearest integer
        skin_age = int(round(estimated_age))

        # Clamp to reasonable range (10-90 to match recommendation engine)
        skin_age = max(10, min(90, skin_age))

        return {
            "skin_age_estimate": skin_age,
            "age_confidence": self._calculate_age_confidence(analysis),
        }

    def _calculate_age_confidence(self, analysis: Dict) -> float:
        """Calculate confidence in age estimation based on data quality"""
        confidence_factors = []

        # Higher confidence if we have strong wrinkle indicators
        wrinkle_score = analysis.get("wrinkle_score", 0)
        if wrinkle_score > 5:  # We detected something
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.5)

        # Higher confidence with good texture data
        texture_score = analysis.get("texture_score", None)
        if texture_score is not None:
            confidence_factors.append(0.75)
        else:
            confidence_factors.append(0.4)

        # Skin tone confidence affects overall confidence
        tone_confidence = analysis.get("skin_tone_confidence", 0.5)
        confidence_factors.append(tone_confidence)

        # Face shape confidence
        shape_confidence = analysis.get("face_shape_confidence", 0.5)
        confidence_factors.append(shape_confidence * 0.8)

        return round(np.mean(confidence_factors), 3)

    def _calculate_overall_score(self, analysis: Dict) -> int:
        """Calculate overall skin health score (0-100, higher is better)"""

        weights = {
            "texture_score": 0.15,
            "hydration_score": 0.15,
            "acne_score": 0.15,
            "wrinkle_score": 0.15,
            "pigmentation_score": 0.10,
            "redness_score": 0.10,
            "smoothness_score": 0.10,
            "sun_damage_score": 0.10,
        }

        score = 0
        for metric, weight in weights.items():
            value = analysis.get(metric, 50)

            # Invert scores where lower is better
            if metric in ["acne_score", "wrinkle_score", "pigmentation_score",
                         "redness_score", "sun_damage_score"]:
                value = 100 - value

            score += value * weight

        return max(0, min(100, int(score)))

    def _calculate_quality_score(self, img: np.ndarray, face_data: Dict, mask: np.ndarray) -> float:
        """
        Calculate comprehensive image quality score for face scan.

        Factors:
        - Resolution (20 points)
        - Lighting (25 points)
        - Sharpness/blur (25 points)
        - Face detection quality (15 points)
        - Skin coverage (15 points)
        """

        score = 0.0
        h, w = img.shape[:2]

        # === Resolution score (max 20 points) ===
        resolution = h * w
        res_score = min(resolution / (1280 * 720), 1.0) * 20
        score += res_score

        # === Lighting score (max 25 points) ===
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        skin_pixels = gray[mask > 0]
        if len(skin_pixels) > 0:
            mean_brightness = np.mean(skin_pixels)
            std_brightness = np.std(skin_pixels)

            # Optimal brightness range
            if 100 <= mean_brightness <= 180:
                light_score = 20
            elif 80 <= mean_brightness <= 200:
                light_score = 15
            else:
                light_score = 8

            # Bonus for even lighting (low std)
            if std_brightness < 35:
                light_score += 5
            elif std_brightness < 50:
                light_score += 2
        else:
            light_score = 10
        score += light_score

        # === Sharpness score (max 25 points) ===
        blur_info = self._detect_blur(img, mask)
        sharpness = blur_info.get("sharpness_score", 0.5)

        if sharpness > 0.8:
            sharp_score = 25
        elif sharpness > 0.6:
            sharp_score = 20
        elif sharpness > 0.4:
            sharp_score = 15
        elif sharpness > 0.3:
            sharp_score = 10
        else:
            sharp_score = 5
        score += sharp_score

        # === Face detection confidence (max 15 points) ===
        if face_data["type"] == "landmarks":
            total_landmarks = len(face_data["data"]) if face_data["data"] else 0
            landmark_score = (total_landmarks / 478) * 15
        else:
            # Bounding box has lower confidence
            landmark_score = 8
        score += landmark_score

        # === Skin coverage (max 15 points) ===
        skin_ratio = np.sum(mask > 0) / (h * w)
        if 0.1 <= skin_ratio <= 0.5:
            coverage_score = 15
        elif 0.05 <= skin_ratio <= 0.6:
            coverage_score = 10
        else:
            coverage_score = 5
        score += coverage_score

        return round(score / 100, 3)

    def _calculate_analysis_confidence(self, analysis: Dict, lighting_quality: float = 0.7) -> float:
        """Calculate overall analysis confidence factoring in all quality indicators"""
        confidences = [
            analysis.get("skin_tone_confidence", 0.7),
            analysis.get("face_shape_confidence", 0.7),
            analysis.get("age_confidence", 0.6),
            lighting_quality,  # Factor in lighting quality
        ]
        return round(np.mean(confidences), 3)

    def _error_response(self, scan_id: str, error: str, elapsed_time: float = 0) -> Dict:
        """Generate error response"""
        return {
            "success": False,
            "scan_id": scan_id,
            "quality_score": 0.0,
            "processing_time_ms": int(elapsed_time * 1000),
            "error": error,
            "analysis": {}
        }

    # Default value functions for fallback
    def _default_skin_tone(self) -> Dict:
        return {
            "skin_tone": "medium",
            "skin_hex_color": "#DEB887",
            "skin_tone_confidence": 0.5,
        }

    def _default_acne(self) -> Dict:
        return {
            "acne_score": 10,
            "whitehead_count": 0,
            "blackhead_count": 0,
            "pimple_count": 0,
            "inflammation_level": 0.0,  # 0.0-1.0 scale
        }

    def _default_wrinkles(self) -> Dict:
        return {
            "wrinkle_score": 15,
            "fine_lines_count": 0,
            "deep_wrinkles_count": 0,
            "forehead_lines_severity": 0.0,  # 0.0-1.0 scale
            "crows_feet_severity": 0.0,
            "nasolabial_folds_severity": 0.0,
        }

    def _default_texture(self) -> Dict:
        return {
            "texture_score": 70,
            "pore_size_average": 0.3,  # mm approximation
            "enlarged_pores_count": 0,
            "roughness_level": 0.0,  # 0.0-1.0 scale
            "smoothness_score": 70,
        }

    def _default_redness(self) -> Dict:
        return {
            "redness_score": 15,
            "sensitivity_level": "low",
            "irritation_detected": False,
            "rosacea_indicators": False,
        }

    def _default_hydration(self) -> Dict:
        return {
            "hydration_score": 65,
            "hydration_level": "normal",
            "oiliness_score": 40,
            "t_zone_oiliness": 0.5,  # 0.0-1.0 scale
            "dry_patches_detected": False,
        }

    def _default_pigmentation(self) -> Dict:
        return {
            "pigmentation_score": 15,
            "dark_spots_count": 0,
            "dark_spots_severity": 0.0,  # 0.0-1.0 scale
            "sun_damage_score": 10,
            "melasma_detected": False,
        }

    def _default_dark_circles(self) -> Dict:
        return {
            "dark_circles_score": 20,
            "dark_circles_left_severity": 0.2,
            "dark_circles_right_severity": 0.2,
            "dark_circles_regions": {
                "left_eye": None,
                "right_eye": None,
            }
        }

    def _extract_face_outline(self, face_data: Dict, img_shape: tuple) -> List[List[float]]:
        """
        Extract face outline coordinates from landmarks for overlay drawing.

        Returns:
            List of [x, y] normalized coordinates (0.0-1.0) forming the face outline
        """
        if face_data.get("type") != "landmarks":
            return []

        # NOTE: Landmarks are stored under "data" key, not "landmarks"
        landmarks = face_data.get("data", [])
        if not landmarks:
            return []

        h, w = img_shape[:2]
        face_outline = []

        # Use FACE_OVAL indices to extract outline points
        for idx in self.FACE_OVAL:
            if idx < len(landmarks):
                lm = landmarks[idx]
                # Normalize to 0.0-1.0 range
                x = round(float(lm.x), 4)
                y = round(float(lm.y), 4)
                face_outline.append([x, y])

        return face_outline

    def _get_low_confidence_defaults(self) -> Dict:
        """Return default analysis values when image quality is too poor"""
        defaults = {}
        defaults.update(self._default_skin_tone())
        defaults.update(self._default_acne())
        defaults.update(self._default_wrinkles())
        defaults.update(self._default_texture())
        defaults.update(self._default_redness())
        defaults.update(self._default_hydration())
        defaults.update(self._default_pigmentation())
        defaults.update(self._default_dark_circles())
        defaults.update({
            "face_shape": "unknown",
            "face_shape_confidence": 0.0,
            "skin_undertone": "unknown",
            "skin_age_estimate": None,
            "age_confidence": 0.0,
            "skin_score": 50,
            "analysis_confidence": 0.2,
            "low_quality_warning": True
        })
        return defaults

    async def get_recommendations(
        self,
        analysis: Dict[str, Any],
        product_catalog: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """
        Get product recommendations based on skin analysis

        Args:
            analysis: Skin analysis results
            product_catalog: Optional list of products to match against

        Returns:
            List of recommended products with match scores
        """
        # Product matching is handled by the backend service
        return []
