"""
Body Scan Service
Handles body scanning using MediaPipe, depth estimation, and 3D reconstruction
"""

import cv2
import numpy as np
import mediapipe as mp
from typing import List, Dict, Optional
import time
import io
from PIL import Image
import trimesh
import json
import os

class BodyScanService:
    def __init__(self):
        """Initialize body scan service with MediaPipe models"""
        # Initialize MediaPipe Pose
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=True,
            min_detection_confidence=0.5
        )

        # Initialize MediaPipe Holistic (for better body tracking)
        self.mp_holistic = mp.solutions.holistic
        self.holistic = self.mp_holistic.Holistic(
            static_image_mode=True,
            model_complexity=2,
            min_detection_confidence=0.5
        )

        self.ready = True

    def is_ready(self) -> bool:
        """Check if service is ready"""
        return self.ready

    async def process_scan(self, scan_id: str, image_data: List[bytes]) -> Dict:
        """
        Process body scan from multiple images

        Args:
            scan_id: Unique identifier for this scan
            image_data: List of image bytes (3-5 images from different angles)

        Returns:
            Dictionary with mesh_url, measurements, quality_score, etc.
        """
        start_time = time.time()

        try:
            # Convert bytes to numpy arrays
            images = []
            for img_bytes in image_data:
                img = Image.open(io.BytesIO(img_bytes))
                img_array = np.array(img)
                # Convert RGB to BGR for OpenCV
                if len(img_array.shape) == 3 and img_array.shape[2] == 3:
                    img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                images.append(img_array)

            # Step 1: Detect body pose and keypoints
            keypoints_list = []
            segmentation_masks = []

            for img in images:
                results = self.pose.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

                if results.pose_landmarks:
                    # Extract 3D keypoints
                    keypoints = []
                    for landmark in results.pose_landmarks.landmark:
                        keypoints.append([
                            landmark.x,
                            landmark.y,
                            landmark.z,
                            landmark.visibility
                        ])
                    keypoints_list.append(keypoints)

                    # Extract segmentation mask
                    if results.segmentation_mask is not None:
                        segmentation_masks.append(results.segmentation_mask)
                else:
                    # If no pose detected in this image, skip it
                    continue

            if len(keypoints_list) == 0:
                raise Exception("No valid body pose detected in any image")

            # Step 2: Extract body measurements from keypoints
            measurements = self._extract_measurements(keypoints_list, images)

            # Step 3: Generate 3D mesh (simplified - would use PIFu or similar in production)
            mesh_data = self._generate_3d_mesh(keypoints_list, measurements)

            # Step 4: Save mesh (in production, upload to S3)
            mesh_url = self._save_mesh(scan_id, mesh_data)

            # Step 5: Calculate quality score
            quality_score = self._calculate_quality_score(keypoints_list, images)

            processing_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "scan_id": scan_id,
                "mesh_url": mesh_url,
                "measurements": measurements,
                "quality_score": quality_score,
                "processing_time_ms": processing_time
            }

        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "scan_id": scan_id,
                "mesh_url": "",
                "measurements": self._get_default_measurements(),
                "quality_score": 0.0,
                "processing_time_ms": processing_time,
                "error": str(e)
            }

    def _extract_measurements(
        self,
        keypoints_list: List[List],
        images: List[np.ndarray]
    ) -> Dict:
        """
        Extract body measurements from detected keypoints

        Uses MediaPipe pose landmarks to estimate body dimensions
        """
        # Use the first image's keypoints (front view ideally)
        keypoints = keypoints_list[0]

        # MediaPipe landmark indices
        LEFT_SHOULDER = 11
        RIGHT_SHOULDER = 12
        LEFT_HIP = 23
        RIGHT_HIP = 24
        LEFT_KNEE = 25
        RIGHT_KNEE = 26
        LEFT_ANKLE = 27
        RIGHT_ANKLE = 28
        NOSE = 0
        LEFT_HEEL = 29
        RIGHT_HEEL = 30

        # Get image dimensions for scaling
        img_height, img_width = images[0].shape[:2]

        # Helper function to calculate distance between two points
        def distance(p1_idx, p2_idx):
            p1 = keypoints[p1_idx]
            p2 = keypoints[p2_idx]
            # Scale by image dimensions and estimate real-world size
            # Assuming average person height ~170cm and proportional scaling
            pixel_dist = np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
            # Rough estimation: if person is ~0.8 of image height, that's ~170cm
            scale_factor = 170 / 0.8
            return pixel_dist * scale_factor

        # Calculate measurements
        # Shoulder width (distance between shoulders)
        shoulder_width = distance(LEFT_SHOULDER, RIGHT_SHOULDER)

        # Hip width (distance between hips)
        hip_width = distance(LEFT_HIP, RIGHT_HIP)

        # Height (nose to heel)
        height = distance(NOSE, LEFT_HEEL)

        # Inseam (hip to ankle)
        inseam = distance(LEFT_HIP, LEFT_ANKLE)

        # Estimate other measurements based on proportions
        # These are rough estimates - would use more sophisticated models in production
        chest = shoulder_width * 2.5  # Typical ratio
        waist = hip_width * 1.8
        hips = hip_width * 2.0
        sleeve_length = shoulder_width * 1.5

        return {
            "height_cm": round(height, 1),
            "chest_cm": round(chest, 1),
            "waist_cm": round(waist, 1),
            "hips_cm": round(hips, 1),
            "inseam_cm": round(inseam, 1),
            "shoulder_width_cm": round(shoulder_width, 1),
            "sleeve_length_cm": round(sleeve_length, 1),
            "neck_cm": round(shoulder_width * 0.8, 1)  # Estimate
        }

    def _generate_3d_mesh(self, keypoints_list: List, measurements: Dict) -> trimesh.Trimesh:
        """
        Generate a 3D mesh from keypoints and measurements

        This is a simplified version. In production, you'd use:
        - PIFu/PIFuHD for detailed reconstruction
        - SMPL model for parametric body model
        - Neural rendering techniques
        """
        # For now, create a simple humanoid mesh using SMPL-like approach
        # This is a placeholder - would use actual 3D reconstruction in production

        # Get keypoints from front view
        keypoints = keypoints_list[0]

        # Create vertices based on keypoints
        vertices = []
        for kp in keypoints:
            # Scale keypoints to real-world dimensions
            height = measurements["height_cm"]
            x = kp[0] * 50 - 25  # Center around 0
            y = -(kp[1] * height - height/2)  # Y is inverted, center at 0
            z = kp[2] * 30  # Depth
            vertices.append([x, y, z])

        vertices = np.array(vertices)

        # Create simple triangular faces connecting the keypoints
        # This creates a wireframe-like mesh
        faces = []

        # Connect body parts (simplified skeleton)
        # Torso connections
        torso_connections = [
            (11, 12), (12, 24), (24, 23), (23, 11),  # Shoulders to hips
            (11, 13), (13, 15),  # Left arm
            (12, 14), (14, 16),  # Right arm
            (23, 25), (25, 27), (27, 31),  # Left leg
            (24, 26), (26, 28), (28, 32),  # Right leg
        ]

        # For simple visualization, we'll create a point cloud
        # In production, you'd have proper mesh with faces

        mesh = trimesh.points.PointCloud(vertices)

        return mesh

    def _save_mesh(self, scan_id: str, mesh: trimesh.Trimesh) -> str:
        """
        Save 3D mesh to file

        In production, this would upload to S3
        Returns URL to the mesh
        """
        # Create output directory
        output_dir = os.path.join(os.getcwd(), "output", "meshes")
        os.makedirs(output_dir, exist_ok=True)

        # Save as GLB (binary glTF)
        mesh_path = os.path.join(output_dir, f"{scan_id}.glb")

        # Export mesh (if it's a point cloud, convert to mesh first)
        try:
            mesh.export(mesh_path)
        except:
            # If export fails, save as PLY instead
            mesh_path = os.path.join(output_dir, f"{scan_id}.ply")
            mesh.export(mesh_path)

        # Return local path (in production, return S3 URL)
        return f"/meshes/{scan_id}.glb"

    def _calculate_quality_score(
        self,
        keypoints_list: List,
        images: List[np.ndarray]
    ) -> float:
        """
        Calculate quality score for the body scan

        Factors:
        - Number of images provided
        - Visibility of keypoints
        - Image quality (resolution, lighting)
        - Pose variation (different angles)
        """
        score = 0.0

        # Factor 1: Number of images (max 30 points)
        num_images = len(keypoints_list)
        score += min(num_images / 5.0, 1.0) * 30

        # Factor 2: Keypoint visibility (max 40 points)
        total_visibility = 0
        for keypoints in keypoints_list:
            for kp in keypoints:
                total_visibility += kp[3]  # visibility score
        avg_visibility = total_visibility / (len(keypoints_list) * len(keypoints_list[0]))
        score += avg_visibility * 40

        # Factor 3: Image quality (max 30 points)
        for img in images:
            height, width = img.shape[:2]
            # Check resolution (prefer > 720p)
            resolution_score = min((height * width) / (1280 * 720), 1.0)
            score += resolution_score * (30 / len(images))

        return round(min(score, 100.0), 1)

    def _get_default_measurements(self) -> Dict:
        """Return default measurements in case of error"""
        return {
            "height_cm": 170.0,
            "chest_cm": 95.0,
            "waist_cm": 80.0,
            "hips_cm": 95.0,
            "inseam_cm": 78.0,
            "shoulder_width_cm": 42.0,
            "sleeve_length_cm": 62.0,
            "neck_cm": 38.0
        }

    async def get_scan_status(self, scan_id: str) -> Optional[Dict]:
        """Get status of a body scan (would query database in production)"""
        # Placeholder - in production, this would query the scan status from DB
        return {
            "scan_id": scan_id,
            "status": "completed",  # pending | processing | completed | failed
            "progress": 100
        }

    def reload_models(self):
        """Reload ML models"""
        # Reinitialize models
        self.__init__()

    def get_model_info(self) -> Dict:
        """Get information about loaded models"""
        return {
            "name": "MediaPipe Pose + Holistic",
            "version": "0.10.8",
            "ready": self.ready,
            "capabilities": [
                "pose_estimation",
                "body_segmentation",
                "3d_reconstruction"
            ]
        }
