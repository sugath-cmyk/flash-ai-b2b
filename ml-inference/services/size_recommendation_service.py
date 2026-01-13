"""
Size Recommendation Service
AI-powered size recommendations based on body measurements
"""

import numpy as np
from typing import Dict, Optional
import json

class SizeRecommendationService:
    def __init__(self):
        """Initialize size recommendation service"""
        # In production, this would load a trained ML model (XGBoost, Random Forest, etc.)
        # For now, we'll use rule-based logic
        self.ready = True

        # Standard size charts (in cm)
        self.size_charts = {
            "tops": {
                "XS": {"chest": (81, 86), "waist": (66, 71)},
                "S": {"chest": (86, 91), "waist": (71, 76)},
                "M": {"chest": (91, 97), "waist": (76, 81)},
                "L": {"chest": (97, 102), "waist": (81, 86)},
                "XL": {"chest": (102, 109), "waist": (86, 94)},
                "XXL": {"chest": (109, 117), "waist": (94, 102)}
            },
            "bottoms": {
                "XS": {"waist": (66, 71), "hips": (86, 91)},
                "S": {"waist": (71, 76), "hips": (91, 97)},
                "M": {"waist": (76, 81), "hips": (97, 102)},
                "L": {"waist": (81, 86), "hips": (102, 107)},
                "XL": {"waist": (86, 94), "hips": (107, 114)},
                "XXL": {"waist": (94, 102), "hips": (114, 122)}
            }
        }

    def is_ready(self) -> bool:
        """Check if service is ready"""
        return self.ready

    async def recommend_size(
        self,
        measurements: Dict,
        product_id: str,
        product_metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Recommend size based on body measurements

        Args:
            measurements: Body measurements (height_cm, chest_cm, waist_cm, hips_cm, etc.)
            product_id: Product identifier
            product_metadata: Optional product info (category, brand, fit_type, etc.)

        Returns:
            Dictionary with recommended_size, confidence, all_sizes, fit_advice
        """
        try:
            # Determine product category (tops or bottoms)
            category = "tops"  # Default
            if product_metadata:
                category = product_metadata.get("category", "tops").lower()
                if "pant" in category or "jean" in category or "short" in category:
                    category = "bottoms"

            # Get measurements
            chest = measurements.get("chest_cm", 95)
            waist = measurements.get("waist_cm", 80)
            hips = measurements.get("hips_cm", 95)
            height = measurements.get("height_cm", 170)

            # Calculate size scores
            size_scores = self._calculate_size_scores(
                chest, waist, hips, height, category
            )

            # Get recommended size (highest score)
            recommended_size = max(size_scores, key=size_scores.get)
            confidence = size_scores[recommended_size]

            # Generate fit advice
            fit_advice = self._generate_fit_advice(
                measurements, recommended_size, category, confidence
            )

            return {
                "recommended_size": recommended_size,
                "confidence": round(confidence, 2),
                "all_sizes": {k: round(v, 2) for k, v in size_scores.items()},
                "fit_advice": fit_advice
            }

        except Exception as e:
            # Return default recommendation on error
            return {
                "recommended_size": "M",
                "confidence": 0.5,
                "all_sizes": {"XS": 0.05, "S": 0.15, "M": 0.5, "L": 0.2, "XL": 0.08, "XXL": 0.02},
                "fit_advice": f"Error calculating size recommendation: {str(e)}. Medium (M) is a safe default."
            }

    def _calculate_size_scores(
        self,
        chest: float,
        waist: float,
        hips: float,
        height: float,
        category: str
    ) -> Dict[str, float]:
        """
        Calculate probability scores for each size

        Uses a Gaussian-like scoring function where measurements closer to
        the size chart range get higher scores
        """
        size_chart = self.size_charts.get(category, self.size_charts["tops"])
        scores = {}

        for size, ranges in size_chart.items():
            # Calculate how well measurements fit this size
            score = 1.0

            if category == "tops":
                # Check chest measurement
                chest_min, chest_max = ranges["chest"]
                chest_score = self._measurement_score(chest, chest_min, chest_max)

                # Check waist measurement
                waist_min, waist_max = ranges["waist"]
                waist_score = self._measurement_score(waist, waist_min, waist_max)

                # Combined score (weighted average)
                score = (chest_score * 0.6 + waist_score * 0.4)

            elif category == "bottoms":
                # Check waist measurement
                waist_min, waist_max = ranges["waist"]
                waist_score = self._measurement_score(waist, waist_min, waist_max)

                # Check hips measurement
                hips_min, hips_max = ranges["hips"]
                hips_score = self._measurement_score(hips, hips_min, hips_max)

                # Combined score (weighted average)
                score = (waist_score * 0.5 + hips_score * 0.5)

            scores[size] = max(score, 0.01)  # Minimum score of 0.01

        # Normalize scores to sum to 1.0
        total = sum(scores.values())
        scores = {k: v / total for k, v in scores.items()}

        return scores

    def _measurement_score(
        self,
        measurement: float,
        range_min: float,
        range_max: float
    ) -> float:
        """
        Calculate score for a measurement given a size range

        Returns:
        - 1.0 if measurement is within range
        - 0.8-0.99 if slightly outside (within 5cm)
        - 0.5-0.79 if moderately outside (within 10cm)
        - 0.1-0.49 if far outside
        """
        range_mid = (range_min + range_max) / 2
        range_width = range_max - range_min

        # Distance from center of range
        distance = abs(measurement - range_mid)

        if distance <= range_width / 2:
            # Perfect fit (within range)
            return 1.0
        elif distance <= range_width / 2 + 2.5:
            # Very close (within 2.5cm of range)
            return 0.9
        elif distance <= range_width / 2 + 5:
            # Close (within 5cm of range)
            return 0.7
        elif distance <= range_width / 2 + 10:
            # Moderate (within 10cm of range)
            return 0.4
        else:
            # Far (more than 10cm from range)
            return 0.1

    def _generate_fit_advice(
        self,
        measurements: Dict,
        recommended_size: str,
        category: str,
        confidence: float
    ) -> str:
        """Generate personalized fit advice based on measurements and recommendation"""

        advice_parts = []

        # Base advice based on confidence
        if confidence >= 0.7:
            advice_parts.append(f"Size {recommended_size} should fit you perfectly!")
        elif confidence >= 0.5:
            advice_parts.append(f"Size {recommended_size} is your best fit.")
        else:
            advice_parts.append(f"Size {recommended_size} is recommended, but consider trying adjacent sizes.")

        # Get size chart
        size_chart = self.size_charts.get(category, self.size_charts["tops"])
        size_range = size_chart.get(recommended_size, {})

        # Add specific fit details
        if category == "tops":
            chest = measurements.get("chest_cm", 95)
            waist = measurements.get("waist_cm", 80)

            chest_range = size_range.get("chest", (0, 0))
            if chest < chest_range[0] - 2:
                advice_parts.append("This may be slightly loose in the chest.")
            elif chest > chest_range[1] + 2:
                advice_parts.append("This may be slightly snug in the chest.")

        elif category == "bottoms":
            waist = measurements.get("waist_cm", 80)
            hips = measurements.get("hips_cm", 95)

            waist_range = size_range.get("waist", (0, 0))
            if waist < waist_range[0] - 2:
                advice_parts.append("Consider a belt for the best fit.")
            elif waist > waist_range[1] + 2:
                advice_parts.append("Look for styles with some stretch for comfort.")

        # General advice
        if confidence < 0.6:
            sizes = list(size_chart.keys())
            size_idx = sizes.index(recommended_size)

            alternatives = []
            if size_idx > 0:
                alternatives.append(sizes[size_idx - 1])
            if size_idx < len(sizes) - 1:
                alternatives.append(sizes[size_idx + 1])

            if alternatives:
                advice_parts.append(f"You might also try {' or '.join(alternatives)}.")

        return " ".join(advice_parts)

    def reload_models(self):
        """Reload ML models"""
        # Reinitialize
        self.__init__()

    def get_model_info(self) -> Dict:
        """Get information about loaded models"""
        return {
            "name": "Rule-based Size Recommendation (MVP)",
            "version": "1.0.0",
            "ready": self.ready,
            "capabilities": [
                "size_recommendation",
                "fit_advice_generation"
            ],
            "note": "In production, this would use a trained ML model (XGBoost, Neural Network, etc.)"
        }
