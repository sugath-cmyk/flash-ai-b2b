"""
Flash AI VTO - ML Inference Service
Main FastAPI application for body scanning and virtual try-on ML inference
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import os
from dotenv import load_dotenv

from services.body_scan_service import BodyScanService
from services.size_recommendation_service import SizeRecommendationService

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Flash AI VTO ML Service",
    description="ML inference service for virtual try-on body scanning and recommendations",
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
            "size_recommendation": size_rec_service.is_ready()
        }
    }

# =============================================================================
# Body Scanning Endpoints
# =============================================================================

@app.post("/body-scan", response_model=BodyScanResponse)
async def process_body_scan(
    scan_id: str,
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
        "size_recommendation": size_rec_service.get_model_info()
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
