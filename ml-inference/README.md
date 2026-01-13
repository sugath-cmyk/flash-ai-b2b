# Flash AI VTO - ML Inference Service

Python FastAPI service for body scanning and virtual try-on ML inference.

## Features

- **Body Scanning**: MediaPipe-based pose estimation and 3D body reconstruction
- **Size Recommendations**: AI-powered size suggestions based on body measurements
- **3D Mesh Generation**: Creates 3D body models from 2D images
- **Measurements Extraction**: Automatic body measurement calculation

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Server

```bash
# Development mode (with auto-reload)
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The service will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Body Scanning
```
POST /body-scan
Content-Type: multipart/form-data

Parameters:
- scan_id: string
- images: file[] (3-5 images)

Response:
{
  "success": true,
  "scan_id": "uuid",
  "mesh_url": "/meshes/uuid.glb",
  "measurements": {
    "height_cm": 175.0,
    "chest_cm": 95.0,
    "waist_cm": 80.0,
    ...
  },
  "quality_score": 85.5,
  "processing_time_ms": 2500
}
```

### Size Recommendation
```
POST /size-recommendation
Content-Type: application/json

Body:
{
  "measurements": {
    "height_cm": 175.0,
    "chest_cm": 95.0,
    "waist_cm": 80.0,
    "hips_cm": 95.0
  },
  "product_id": "product-123",
  "product_metadata": {
    "category": "tops"
  }
}

Response:
{
  "recommended_size": "M",
  "confidence": 0.85,
  "all_sizes": {
    "XS": 0.05,
    "S": 0.15,
    "M": 0.85,
    "L": 0.10,
    "XL": 0.03,
    "XXL": 0.02
  },
  "fit_advice": "Size M should fit you perfectly!"
}
```

## Development

### Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=services
```

### Code Formatting

```bash
# Format code
black .
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

Make sure to set these in production:
- `ALLOWED_ORIGINS`: Your backend URL
- `AWS_*`: S3 credentials for mesh storage
- `MODEL_DEVICE`: Set to 'cuda' if GPU available

## Architecture

```
ml-inference/
├── main.py                          # FastAPI app
├── services/
│   ├── body_scan_service.py        # Body scanning ML
│   └── size_recommendation_service.py  # Size recommendations
├── models/                          # Trained models (not in git)
├── output/
│   └── meshes/                     # Generated 3D meshes
└── utils/                          # Helper functions
```

## Current Capabilities

### Body Scanning (MVP)
- ✅ MediaPipe pose estimation
- ✅ Keypoint detection
- ✅ Body measurement extraction
- ✅ Simple 3D mesh generation
- ⏳ Advanced 3D reconstruction (PIFu/PIFuHD)
- ⏳ Texture mapping
- ⏳ Physics-based cloth simulation

### Size Recommendation (MVP)
- ✅ Rule-based size recommendation
- ✅ Multi-category support (tops, bottoms)
- ✅ Fit advice generation
- ⏳ ML model training (XGBoost/Neural Network)
- ⏳ Brand-specific sizing
- ⏳ User feedback integration

## Future Enhancements

1. **Advanced 3D Reconstruction**
   - Implement PIFu/PIFuHD for detailed body models
   - Add texture and color mapping
   - Improve mesh quality

2. **ML-Based Size Recommendations**
   - Train on real customer data
   - Brand-specific models
   - Return/exchange prediction

3. **Performance Optimization**
   - Model quantization
   - GPU acceleration
   - Batch processing
   - Model caching

4. **Additional Features**
   - Virtual garment try-on
   - Cloth physics simulation
   - Pose estimation from video
   - Multi-person support
