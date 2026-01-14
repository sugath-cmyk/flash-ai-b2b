"""
Flash AI VTO - ML Inference Service
Main FastAPI application for body scanning and virtual try-on ML inference
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import os
import traceback
from dotenv import load_dotenv

from services.body_scan_service_simple import BodyScanService
from services.size_recommendation_service import SizeRecommendationService
from services.face_scan_service import FaceScanService

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Flash AI VTO & Skin Analysis ML Service",
    description="ML inference service for virtual try-on, face scanning, and skin analysis",
    version="1.0.0"
)

# CORS middleware - allow requests from Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
body_scan_service = BodyScanService()
size_rec_service = SizeRecommendationService()
face_scan_service = FaceScanService()

# =============================================================================
# Request/Response Models
# =============================================================================

class BodyMeasurements(BaseModel):
    height_cm: float
    chest_cm: float
    waist_cm: float
    hips_cm: float
    inseam_cm: Optional[float] = None
    shoulder_width_cm: Optional[float] = None
    sleeve_length_cm: Optional[float] = None
    neck_cm: Optional[float] = None

class BodyScanResponse(BaseModel):
    success: bool
    scan_id: str
    mesh_url: str
    measurements: BodyMeasurements
    quality_score: float
    processing_time_ms: int
    error: Optional[str] = None

class SizeRecommendationRequest(BaseModel):
    measurements: BodyMeasurements
    product_id: str
    product_metadata: Optional[Dict] = None

class SizeRecommendationResponse(BaseModel):
    recommended_size: str
    confidence: float
    all_sizes: Dict[str, float]
    fit_advice: str

# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "ml-inference",
        "version": "1.0.0",
        "models": {
            "pose_estimation": body_scan_service.is_ready(),
            "size_recommendation": size_rec_service.is_ready(),
            "face_scan": face_scan_service.is_ready()
        }
    }

# =============================================================================
# Body Scanning Endpoints
# =============================================================================

@app.post("/body-scan", response_model=BodyScanResponse)
async def process_body_scan(
    scan_id: str = Form(...),
    images: List[UploadFile] = File(...)
):
    """
    Process body scan from uploaded images

    - **scan_id**: Unique identifier for this scan
    - **images**: 3-5 images from different angles (front, side, back)

    Returns:
    - 3D mesh URL
    - Body measurements
    - Quality score
    """
    try:
        # Validate images
        if len(images) < 3:
            raise HTTPException(
                status_code=400,
                detail="At least 3 images required for body scanning"
            )

        # Read image data
        image_data = []
        for image in images:
            content = await image.read()
            image_data.append(content)

        # Process body scan
        result = await body_scan_service.process_scan(scan_id, image_data)

        return BodyScanResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/body-scan/{scan_id}/status")
async def get_scan_status(scan_id: str):
    """Get status of a body scan"""
    status = await body_scan_service.get_scan_status(scan_id)
    if not status:
        raise HTTPException(status_code=404, detail="Scan not found")
    return status

# =============================================================================
# Face Scan & Skin Analysis Endpoints
# =============================================================================

@app.post("/face-scan")
async def process_face_scan(
    scan_id: str = Form(...),
    images: List[UploadFile] = File(...)
):
    """
    Process face scan and perform comprehensive skin analysis

    - **scan_id**: Unique identifier for this scan
    - **images**: 1-3 facial images (front, profile views)

    Returns:
    - Comprehensive skin analysis with scores for:
      * Pigmentation (dark spots, sun damage)
      * Acne & blemishes
      * Wrinkles & fine lines
      * Skin texture & pores
      * Redness & sensitivity
      * Hydration levels
    - Overall skin score
    - Skin age estimate
    - Problem area overlays for visualization
    """
    try:
        # Validate images
        if len(images) < 1:
            raise HTTPException(
                status_code=400,
                detail="At least 1 image required for face scanning"
            )

        # Read image data
        image_data = []
        for image in images:
            content = await image.read()
            image_data.append(content)
            print(f"[FaceScan] Read image: {image.filename}, size: {len(content)} bytes")

        print(f"[FaceScan] Processing {len(image_data)} images for scan_id: {scan_id}")

        # Process face scan
        try:
            result = await face_scan_service.analyze_face(scan_id, image_data)
            print(f"[FaceScan] Result success: {result.get('success', False)}")
            return result
        except Exception as analysis_error:
            error_msg = f"Analysis failed: {str(analysis_error)}"
            print(f"[FaceScan] Analysis ERROR: {error_msg}")
            print(traceback.format_exc())
            # Return error response instead of 500
            return {
                "success": False,
                "scan_id": scan_id,
                "quality_score": 0.0,
                "processing_time_ms": 0,
                "error": error_msg,
                "analysis": {}
            }

    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[FaceScan] ERROR: {error_detail}")
        # Return error response instead of raising 500
        return {
            "success": False,
            "scan_id": scan_id if 'scan_id' in dir() else "unknown",
            "quality_score": 0.0,
            "processing_time_ms": 0,
            "error": str(e),
            "analysis": {}
        }

# =============================================================================
# Size Recommendation Endpoints
# =============================================================================

@app.post("/size-recommendation", response_model=SizeRecommendationResponse)
async def get_size_recommendation(request: SizeRecommendationRequest):
    """
    Get AI-powered size recommendation based on body measurements

    - **measurements**: Body measurements in cm
    - **product_id**: Product identifier
    - **product_metadata**: Optional product information (brand, fit type, etc.)

    Returns:
    - Recommended size
    - Confidence score
    - Probability distribution across all sizes
    - Fit advice
    """
    try:
        result = await size_rec_service.recommend_size(
            measurements=request.measurements.dict(),
            product_id=request.product_id,
            product_metadata=request.product_metadata
        )

        return SizeRecommendationResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Model Management Endpoints
# =============================================================================

@app.post("/models/reload")
async def reload_models():
    """Reload ML models (admin endpoint)"""
    try:
        body_scan_service.reload_models()
        size_rec_service.reload_models()
        return {"status": "success", "message": "Models reloaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/info")
async def get_models_info():
    """Get information about loaded models"""
    return {
        "body_scan": body_scan_service.get_model_info(),
        "size_recommendation": size_rec_service.get_model_info(),
        "face_scan": face_scan_service.get_model_info()
    }

@app.get("/face-scan/test")
async def face_scan_test():
    """Test face scan with a synthetic image"""
    import numpy as np
    from PIL import Image
    import io

    try:
        # Create a simple test image (white rectangle)
        test_img = np.ones((480, 640, 3), dtype=np.uint8) * 200

        # Convert to bytes (JPEG format)
        pil_img = Image.fromarray(test_img)
        buffer = io.BytesIO()
        pil_img.save(buffer, format='JPEG')
        img_bytes = buffer.getvalue()

        print(f"[FaceScan Test] Created test image: {len(img_bytes)} bytes")

        # Try to process it
        result = await face_scan_service.analyze_face("test-scan-123", [img_bytes])

        return {
            "test": "completed",
            "result_success": result.get("success", False),
            "result_error": result.get("error"),
            "has_analysis": bool(result.get("analysis")),
        }
    except Exception as e:
        import traceback
        return {
            "test": "failed",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/face-scan/debug")
async def face_scan_debug():
    """Debug endpoint for face scan service"""
    import cv2

    # Test if we can create basic CV objects
    test_results = {}
    try:
        # Test numpy
        import numpy as np
        test_arr = np.zeros((100, 100, 3), dtype=np.uint8)
        test_results["numpy"] = "ok"
    except Exception as e:
        test_results["numpy"] = str(e)

    try:
        # Test OpenCV
        gray = cv2.cvtColor(test_arr, cv2.COLOR_BGR2GRAY)
        test_results["opencv_convert"] = "ok"
    except Exception as e:
        test_results["opencv_convert"] = str(e)

    try:
        # Test PIL
        from PIL import Image
        import io
        pil_img = Image.fromarray(test_arr)
        test_results["pil"] = "ok"
    except Exception as e:
        test_results["pil"] = str(e)

    try:
        # Test MediaPipe image creation
        if face_scan_service.use_mediapipe:
            import mediapipe as mp
            rgb_arr = np.zeros((100, 100, 3), dtype=np.uint8)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_arr)
            test_results["mediapipe_image"] = "ok"
    except Exception as e:
        test_results["mediapipe_image"] = str(e)

    return {
        "service_ready": face_scan_service.is_ready(),
        "model_info": face_scan_service.get_model_info(),
        "opencv_version": cv2.__version__,
        "mediapipe_available": face_scan_service.use_mediapipe,
        "face_cascade_loaded": face_scan_service.face_cascade is not None,
        "tests": test_results,
    }

# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
