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
            "name": "FaceScan-v2",
            "version": "2.0.0",
            "capabilities": [
                "skin_tone_detection",
                "skin_analysis",
                "problem_detection",
                "age_estimation",
                "face_shape_classification"
            ],
            "engine": "OpenCV" + (" + MediaPipe" if self.use_mediapipe else "")
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
        Analyze facial images for comprehensive skin analysis

        Args:
            scan_id: Unique scan identifier
            image_data: List of image bytes

        Returns:
            Dictionary containing quality_score and detailed analysis
        """
        start_time = time.time()

        try:
            # Step 1: Load and preprocess images
            images, face_data_list = self._process_images(image_data)

            if not face_data_list:
                return self._error_response(scan_id, "No face detected in images", time.time() - start_time)

            # Step 2: Use primary image (first with valid face)
            img = images[0]
            face_data = face_data_list[0]

            # Step 3: Extract skin mask
            skin_mask = self._create_skin_mask(img, face_data)

            # Step 4: Extract skin region for analysis
            skin_region = cv2.bitwise_and(img, img, mask=skin_mask)

            # Step 5: Run all analysis modules
            analysis = {}

            # Color analysis
            try:
                skin_tone_result = self._analyze_skin_tone(skin_region, skin_mask)
                analysis.update(skin_tone_result)
            except Exception as e:
                analysis.update(self._default_skin_tone())

            # Undertone detection
            try:
                undertone_result = self._analyze_undertone(skin_region, skin_mask)
                analysis.update(undertone_result)
            except Exception:
                analysis["skin_undertone"] = "neutral"

            # Face shape classification
            try:
                face_shape_result = self._classify_face_shape(face_data, img.shape)
                analysis.update(face_shape_result)
            except Exception:
                analysis.update({"face_shape": "oval", "face_shape_confidence": 0.5})

            # Acne/blemish detection
            try:
                acne_result = self._detect_acne(img, skin_mask, face_data)
                analysis.update(acne_result)
            except Exception:
                analysis.update(self._default_acne())

            # Wrinkle detection
            try:
                wrinkle_result = self._detect_wrinkles(img, skin_mask, face_data)
                analysis.update(wrinkle_result)
            except Exception:
                analysis.update(self._default_wrinkles())

            # Texture analysis
            try:
                texture_result = self._analyze_texture(img, skin_mask)
                analysis.update(texture_result)
            except Exception:
                analysis.update(self._default_texture())

            # Redness/sensitivity
            try:
                redness_result = self._analyze_redness(img, skin_mask)
                analysis.update(redness_result)
            except Exception:
                analysis.update(self._default_redness())

            # Hydration/oiliness
            try:
                hydration_result = self._analyze_hydration(img, skin_mask, face_data)
                analysis.update(hydration_result)
            except Exception:
                analysis.update(self._default_hydration())

            # Pigmentation/dark spots
            try:
                pigmentation_result = self._detect_pigmentation(img, skin_mask)
                analysis.update(pigmentation_result)
            except Exception:
                analysis.update(self._default_pigmentation())

            # Skin age estimation
            try:
                age_result = self._estimate_skin_age(analysis)
                analysis.update(age_result)
            except Exception:
                analysis["skin_age_estimate"] = 30

            # Calculate overall skin score
            analysis["skin_score"] = self._calculate_overall_score(analysis)

            # Add analysis confidence
            analysis["analysis_confidence"] = self._calculate_analysis_confidence(analysis)

            # Calculate quality score
            quality_score = self._calculate_quality_score(img, face_data, skin_mask)

            processing_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "scan_id": scan_id,
                "quality_score": quality_score,
                "processing_time_ms": processing_time,
                "analysis": analysis
            }

        except Exception as e:
            return self._error_response(scan_id, str(e), time.time() - start_time)

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
        """Detect acne and blemishes using blob detection and color analysis"""

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray_masked = cv2.bitwise_and(gray, gray, mask=mask)

        # Convert to HSV for redness detection
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # Detect red/inflamed areas (acne typically appears redder)
        lower_red1 = np.array([0, 50, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 50, 50])
        upper_red2 = np.array([180, 255, 255])

        red_mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = cv2.bitwise_or(red_mask1, red_mask2)
        red_mask = cv2.bitwise_and(red_mask, mask)

        # Blob detection for pimples/blemishes
        blurred = cv2.GaussianBlur(gray_masked, (5, 5), 0)

        # Adaptive threshold for darker spots (blackheads)
        thresh_dark = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        thresh_dark = cv2.bitwise_and(thresh_dark, mask)

        # Find contours
        contours_dark, _ = cv2.findContours(
            thresh_dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        # Filter by size and shape
        blackhead_count = 0
        pimple_count = 0
        whitehead_count = 0

        min_area = 15
        max_area = 400
        skin_area = max(np.sum(mask > 0), 1)
        area_scale = skin_area / 100000  # Normalize for image size

        for cnt in contours_dark:
            area = cv2.contourArea(cnt)
            scaled_min = min_area * max(area_scale, 0.5)
            scaled_max = max_area * max(area_scale, 0.5)

            if scaled_min < area < scaled_max:
                perimeter = cv2.arcLength(cnt, True)
                if perimeter > 0:
                    circularity = 4 * np.pi * area / (perimeter ** 2)
                    if circularity > 0.3:
                        blackhead_count += 1

        # Detect pimples using red mask
        contours_red, _ = cv2.findContours(
            red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        for cnt in contours_red:
            area = cv2.contourArea(cnt)
            if min_area * max(area_scale, 0.5) < area < max_area * 2 * max(area_scale, 0.5):
                pimple_count += 1

        # Detect whiteheads (bright spots)
        _, thresh_bright = cv2.threshold(blurred, 200, 255, cv2.THRESH_BINARY)
        thresh_bright = cv2.bitwise_and(thresh_bright, mask)

        contours_bright, _ = cv2.findContours(
            thresh_bright, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        for cnt in contours_bright:
            area = cv2.contourArea(cnt)
            if min_area * max(area_scale, 0.5) < area < max_area * max(area_scale, 0.5):
                whitehead_count += 1

        # Cap counts to reasonable values
        blackhead_count = min(blackhead_count, 25)
        pimple_count = min(pimple_count, 15)
        whitehead_count = min(whitehead_count, 15)

        # Calculate acne score (0-100, lower is better)
        total_blemishes = blackhead_count + pimple_count * 2 + whitehead_count
        acne_score = min(100, total_blemishes * 2)

        # Determine inflammation level (0.0-1.0 scale for database)
        red_pixel_ratio = np.sum(red_mask > 0) / skin_area
        if red_pixel_ratio > 0.12:
            inflammation = 0.66  # moderate
        elif red_pixel_ratio > 0.04:
            inflammation = 0.33  # mild
        else:
            inflammation = 0.0  # none

        return {
            "acne_score": int(acne_score),
            "whitehead_count": int(whitehead_count),
            "blackhead_count": int(blackhead_count),
            "pimple_count": int(pimple_count),
            "inflammation_level": float(inflammation),
        }

    def _detect_wrinkles(self, img: np.ndarray, mask: np.ndarray, face_data: Dict) -> Dict:
        """Detect wrinkles using edge detection"""

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # Apply bilateral filter to reduce noise while preserving edges
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)

        # Canny edge detection
        edges = cv2.Canny(filtered, 30, 100)
        edges = cv2.bitwise_and(edges, mask)

        # Laplacian for line-like structures
        laplacian = cv2.Laplacian(filtered, cv2.CV_64F)
        laplacian = np.uint8(np.absolute(laplacian))
        laplacian = cv2.bitwise_and(laplacian, mask)

        forehead_severity = "none"
        crows_feet_severity = "none"
        nasolabial_severity = "none"

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

            def count_lines_in_region(edge_img, region_mask):
                region_edges = cv2.bitwise_and(edge_img, region_mask)
                lines = cv2.HoughLinesP(region_edges, 1, np.pi / 180, 10,
                                        minLineLength=5, maxLineGap=3)
                return len(lines) if lines is not None else 0

            # Analyze specific regions (severity as 0.0-1.0 for database)
            forehead_mask = get_region_mask(self.FOREHEAD)
            forehead_lines = count_lines_in_region(edges, forehead_mask)
            forehead_severity = 0.66 if forehead_lines > 20 else (0.33 if forehead_lines > 8 else 0.0)

            left_cf_mask = get_region_mask(self.LEFT_CROWS_FEET)
            right_cf_mask = get_region_mask(self.RIGHT_CROWS_FEET)
            crows_feet_lines = count_lines_in_region(edges, left_cf_mask) + \
                              count_lines_in_region(edges, right_cf_mask)
            crows_feet_severity = 0.66 if crows_feet_lines > 25 else (0.33 if crows_feet_lines > 10 else 0.0)

            left_nl_mask = get_region_mask(self.LEFT_NASOLABIAL)
            right_nl_mask = get_region_mask(self.RIGHT_NASOLABIAL)
            nasolabial_lines = count_lines_in_region(edges, left_nl_mask) + \
                              count_lines_in_region(edges, right_nl_mask)
            nasolabial_severity = 0.66 if nasolabial_lines > 15 else (0.33 if nasolabial_lines > 5 else 0.0)

        # Edge density for overall wrinkle score
        total_edges = np.sum(edges > 0)
        skin_area = max(np.sum(mask > 0), 1)
        edge_density = total_edges / skin_area

        # Fine lines vs deep wrinkles
        laplacian_masked = laplacian[mask > 0]
        if len(laplacian_masked) > 0:
            high_intensity = np.sum(laplacian_masked > 80)
            medium_intensity = np.sum((laplacian_masked > 25) & (laplacian_masked <= 80))
            fine_lines_count = min(50, int(medium_intensity / 150))
            deep_wrinkles_count = min(15, int(high_intensity / 300))
        else:
            fine_lines_count = 0
            deep_wrinkles_count = 0

        # Calculate wrinkle score
        wrinkle_score = min(100, int(edge_density * 400) + deep_wrinkles_count * 4)

        return {
            "wrinkle_score": int(wrinkle_score),
            "fine_lines_count": int(fine_lines_count),
            "deep_wrinkles_count": int(deep_wrinkles_count),
            "forehead_lines_severity": float(forehead_severity),
            "crows_feet_severity": float(crows_feet_severity),
            "nasolabial_folds_severity": float(nasolabial_severity),
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

        pore_sizes = []
        enlarged_pores = 0
        skin_area = max(np.sum(mask > 0), 1)
        area_scale = skin_area / 100000

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 3 * max(area_scale, 0.5) < area < 80 * max(area_scale, 0.5):
                pore_sizes.append(area)
                if area > 25 * max(area_scale, 0.5):
                    enlarged_pores += 1

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
        }

    def _analyze_redness(self, img: np.ndarray, mask: np.ndarray) -> Dict:
        """Analyze skin redness and sensitivity using HSV color analysis"""

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        hsv_pixels = hsv[mask > 0]

        if len(hsv_pixels) == 0:
            return self._default_redness()

        h_channel = hsv_pixels[:, 0]
        s_channel = hsv_pixels[:, 1]
        total_pixels = len(h_channel)

        # Count reddish pixels (H: 0-15 and 165-180)
        red_pixels = np.sum((h_channel < 15) | (h_channel > 165))
        red_ratio = red_pixels / total_pixels

        # Intense red (higher saturation)
        intense_red = np.sum(((h_channel < 15) | (h_channel > 165)) & (s_channel > 80))
        intense_ratio = intense_red / total_pixels

        # Calculate redness score
        redness_score = min(100, int(red_ratio * 80 + intense_ratio * 120))

        # Determine sensitivity level
        if intense_ratio > 0.12:
            sensitivity = "high"
        elif intense_ratio > 0.04:
            sensitivity = "medium"
        else:
            sensitivity = "low"

        # Check for irritation patterns
        red_binary = np.zeros_like(mask)
        hsv_full = hsv.copy()
        red_binary[((hsv_full[:, :, 0] < 15) | (hsv_full[:, :, 0] > 165)) & (mask > 0)] = 255

        num_labels, _ = cv2.connectedComponents(red_binary)
        irritation_detected = bool((num_labels - 1) > 5)

        # Rosacea indicators
        rosacea_indicators = bool(intense_ratio > 0.18 and red_ratio > 0.35)

        return {
            "redness_score": int(redness_score),
            "sensitivity_level": sensitivity,
            "irritation_detected": irritation_detected,
            "rosacea_indicators": rosacea_indicators,
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

        # Hydration score
        if shine_ratio < 0.02 and mean_brightness < 140:
            hydration_score = int(max(30, 55 - int(brightness_std / 2)))
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
        """Detect pigmentation issues and dark spots using LAB color space"""

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]

        skin_lightness = l_channel[mask > 0]
        if len(skin_lightness) == 0:
            return self._default_pigmentation()

        mean_lightness = np.mean(skin_lightness)
        std_lightness = np.std(skin_lightness)

        # Dark spots threshold
        dark_threshold = mean_lightness - 1.5 * std_lightness
        dark_threshold = max(dark_threshold, mean_lightness * 0.7)

        dark_mask = (l_channel < dark_threshold).astype(np.uint8) * 255
        dark_mask = cv2.bitwise_and(dark_mask, mask)

        # Morphological cleanup
        kernel = np.ones((3, 3), np.uint8)
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel)
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(dark_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        dark_spots_count = 0
        total_dark_area = 0
        skin_area = max(np.sum(mask > 0), 1)
        area_scale = skin_area / 100000

        large_patches = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 15 * max(area_scale, 0.5) < area < 1500 * max(area_scale, 0.5):
                dark_spots_count += 1
                total_dark_area += area
                if area > 400 * max(area_scale, 0.5):
                    large_patches += 1

        dark_spots_count = min(dark_spots_count, 25)

        # Pigmentation score
        dark_ratio = total_dark_area / skin_area
        pigmentation_score = min(100, int(dark_ratio * 400 + dark_spots_count * 2.5))

        # Severity classification (0.0-1.0 scale for database)
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

        # Melasma detection
        melasma_detected = bool(large_patches >= 2)

        return {
            "pigmentation_score": int(pigmentation_score),
            "dark_spots_count": int(dark_spots_count),
            "dark_spots_severity": float(severity),
            "sun_damage_score": sun_damage_score,
            "melasma_detected": melasma_detected,
        }

    def _estimate_skin_age(self, analysis: Dict) -> Dict:
        """Estimate skin age based on analysis metrics"""

        base_age = 25

        # Wrinkle contribution
        wrinkle_score = analysis.get("wrinkle_score", 0)
        if wrinkle_score > 60:
            base_age += 15
        elif wrinkle_score > 40:
            base_age += 10
        elif wrinkle_score > 20:
            base_age += 5

        # Fine lines
        fine_lines = analysis.get("fine_lines_count", 0)
        base_age += min(fine_lines // 6, 7)

        # Deep wrinkles
        deep_wrinkles = analysis.get("deep_wrinkles_count", 0)
        base_age += deep_wrinkles * 2

        # Texture
        texture_score = analysis.get("texture_score", 70)
        if texture_score < 50:
            base_age += 4
        elif texture_score > 80:
            base_age -= 2

        # Pigmentation
        pigmentation = analysis.get("pigmentation_score", 0)
        if pigmentation > 50:
            base_age += 4
        elif pigmentation > 30:
            base_age += 2

        # Sun damage
        sun_damage = analysis.get("sun_damage_score", 0)
        base_age += min(sun_damage // 25, 4)

        # Hydration bonus
        hydration = analysis.get("hydration_score", 70)
        if hydration > 80:
            base_age -= 2
        elif hydration < 50:
            base_age += 2

        # Clamp to reasonable range
        skin_age = max(18, min(65, base_age))

        return {
            "skin_age_estimate": skin_age,
        }

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
        """Calculate image quality score for face scan"""

        score = 0.0
        h, w = img.shape[:2]

        # Resolution score (max 25 points)
        resolution = h * w
        res_score = min(resolution / (1280 * 720), 1.0) * 25
        score += res_score

        # Lighting score (max 30 points)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        skin_pixels = gray[mask > 0]
        if len(skin_pixels) > 0:
            mean_brightness = np.mean(skin_pixels)
            if 100 <= mean_brightness <= 180:
                light_score = 30
            elif 80 <= mean_brightness <= 200:
                light_score = 22
            else:
                light_score = 12
        else:
            light_score = 15
        score += light_score

        # Face detection confidence (max 25 points)
        if face_data["type"] == "landmarks":
            total_landmarks = len(face_data["data"]) if face_data["data"] else 0
            landmark_score = (total_landmarks / 478) * 25
        else:
            # Bounding box has lower confidence
            landmark_score = 15
        score += landmark_score

        # Skin coverage (max 20 points)
        skin_ratio = np.sum(mask > 0) / (h * w)
        if 0.1 <= skin_ratio <= 0.5:
            coverage_score = 20
        elif 0.05 <= skin_ratio <= 0.6:
            coverage_score = 15
        else:
            coverage_score = 8
        score += coverage_score

        return round(score / 100, 3)

    def _calculate_analysis_confidence(self, analysis: Dict) -> float:
        """Calculate overall analysis confidence"""
        confidences = [
            analysis.get("skin_tone_confidence", 0.7),
            analysis.get("face_shape_confidence", 0.7),
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
