// Virtual Try-On (VTO) Types

export interface VTOSettings {
  id: string;
  store_id: string;
  enabled: boolean;
  mode: 'floating' | 'inline' | 'both';
  button_position: string;
  button_text: string;
  primary_color: string;
  created_at: Date;
  updated_at: Date;
}

export interface BodyScan {
  id: string;
  user_id?: string;
  visitor_id?: string;
  store_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  image_urls: string[];
  mesh_url?: string;
  quality_score?: number;
  processing_time_ms?: number;
  error_message?: string;
  created_at: Date;
  completed_at?: Date;
}

export interface BodyMeasurements {
  id: string;
  body_scan_id: string;
  height_cm?: number;
  weight_kg?: number;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  inseam_cm?: number;
  shoulder_width_cm?: number;
  sleeve_length_cm?: number;
  neck_cm?: number;
  confidence_score?: number;
  measured_at: Date;
}

export interface VTOSession {
  id: string;
  body_scan_id?: string;
  product_id?: string;
  variant_id?: string;
  visitor_id: string;
  store_id: string;
  duration_seconds: number;
  garments_tried: number;
  screenshot_taken: boolean;
  shared_social: boolean;
  converted: boolean;
  session_data?: SessionData;
  created_at: Date;
  ended_at?: Date;
}

export interface SessionData {
  poses?: PoseData[];
  interactions?: InteractionEvent[];
  screenshots?: string[];
  [key: string]: any;
}

export interface PoseData {
  timestamp: number;
  keypoints: number[][]; // 3D coordinates [x, y, z]
  confidence: number;
}

export interface InteractionEvent {
  timestamp: number;
  action: 'change_garment' | 'change_pose' | 'zoom' | 'rotate' | 'screenshot' | 'share';
  data?: any;
}

export interface SizeRecommendation {
  id: string;
  body_scan_id?: string;
  product_id: string;
  variant_id?: string;
  recommended_size: string;
  confidence: number;
  all_sizes: Record<string, number>; // { "S": 0.1, "M": 0.7, "L": 0.2 }
  fit_advice?: string;
  created_at: Date;
}

export interface VTOEvent {
  id: string;
  event_type: VTOEventType;
  store_id: string;
  visitor_id?: string;
  session_id?: string;
  product_id?: string;
  variant_id?: string;
  metadata?: any;
  timestamp: Date;
}

export type VTOEventType =
  | 'body_scan_started'
  | 'body_scan_completed'
  | 'body_scan_failed'
  | 'try_on_started'
  | 'try_on_ended'
  | 'garment_changed'
  | 'pose_changed'
  | 'screenshot_taken'
  | 'social_shared'
  | 'size_recommended'
  | 'add_to_cart'
  | 'purchase_completed';

// Request/Response DTOs

export interface CreateBodyScanRequest {
  images: Buffer[] | string[]; // Buffer for multipart, string for base64
  visitor_id: string;
  store_id: string;
}

export interface CreateBodyScanResponse {
  scan_id: string;
  status: 'pending' | 'processing';
  message?: string;
}

export interface GetBodyScanResponse {
  scan: BodyScan;
  measurements?: BodyMeasurements;
}

export interface StartTryOnSessionRequest {
  body_scan_id: string;
  product_id: string;
  variant_id?: string;
  visitor_id: string;
  store_id: string;
}

export interface StartTryOnSessionResponse {
  session_id: string;
  render_data: RenderData;
}

export interface RenderData {
  body_mesh_url: string;
  garment_mesh_url?: string;
  garment_data?: GarmentData;
  initial_pose?: PoseData;
}

export interface GarmentData {
  id: string;
  name: string;
  category: 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'accessories';
  fabric_properties: FabricProperties;
  available_sizes: string[];
  available_colors: string[];
  texture_urls: {
    albedo?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    ao?: string; // Ambient occlusion
  };
}

export interface FabricProperties {
  stiffness: number; // 0-1
  elasticity: number; // 0-1
  weight: number; // g/m²
  thickness: number; // mm
  drape_coefficient: number;
  friction: number;
}

export interface GetSizeRecommendationRequest {
  body_scan_id: string;
  product_id: string;
  variant_id?: string;
}

export interface GetSizeRecommendationResponse {
  recommended_size: string;
  confidence: number;
  all_sizes: Record<string, number>;
  fit_advice: string;
  alternative_sizes?: string[];
}

export interface UpdateVTOSettingsRequest {
  enabled?: boolean;
  mode?: 'floating' | 'inline' | 'both';
  button_position?: string;
  button_text?: string;
  primary_color?: string;
}

export interface VTOAnalyticsResponse {
  total_scans: number;
  total_sessions: number;
  avg_session_duration: number;
  conversion_rate: number;
  top_products: ProductAnalytics[];
  timeline: TimelineData[];
  size_recommendations: SizeRecommendationAnalytics;
}

export interface ProductAnalytics {
  product_id: string;
  product_name: string;
  try_on_count: number;
  conversion_rate: number;
  avg_session_duration: number;
}

export interface TimelineData {
  date: string;
  scans: number;
  sessions: number;
  conversions: number;
}

export interface SizeRecommendationAnalytics {
  total_recommendations: number;
  accuracy?: number; // If we have feedback data
  most_recommended_sizes: Record<string, number>;
}

// ML Service Communication Types

export interface MLBodyScanRequest {
  scan_id: string;
  image_urls: string[];
}

export interface MLBodyScanResponse {
  success: boolean;
  mesh_url: string;
  measurements: {
    height_cm: number;
    chest_cm: number;
    waist_cm: number;
    hips_cm: number;
    inseam_cm: number;
    shoulder_width_cm: number;
    sleeve_length_cm: number;
    neck_cm: number;
  };
  quality_score: number;
  processing_time_ms: number;
  error?: string;
}

export interface MLTryOnRequest {
  body_mesh_url: string;
  product_id: string;
  garment_mesh_url?: string;
}

export interface MLTryOnResponse {
  success: boolean;
  render_data: RenderData;
  error?: string;
}

export interface MLSizeRecommendationRequest {
  measurements: {
    height_cm: number;
    chest_cm: number;
    waist_cm: number;
    hips_cm: number;
  };
  product_id: string;
  product_metadata?: any;
}

export interface MLSizeRecommendationResponse {
  recommended_size: string;
  confidence: number;
  all_sizes: Record<string, number>;
  fit_advice: string;
}

// Constants

export const VTO_EVENT_TYPES = [
  'body_scan_started',
  'body_scan_completed',
  'body_scan_failed',
  'try_on_started',
  'try_on_ended',
  'garment_changed',
  'pose_changed',
  'screenshot_taken',
  'social_shared',
  'size_recommended',
  'add_to_cart',
  'purchase_completed',
] as const;

export const BODY_SCAN_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

export const VTO_MODES = ['floating', 'inline', 'both'] as const;

export const GARMENT_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'accessories'] as const;

export const BUTTON_POSITIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center-left',
  'center-right',
] as const;

// Error types

export class VTOError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'VTOError';
  }
}

export class BodyScanError extends VTOError {
  constructor(message: string, code: string = 'BODY_SCAN_ERROR') {
    super(message, code, 400);
    this.name = 'BodyScanError';
  }
}

export class TryOnSessionError extends VTOError {
  constructor(message: string, code: string = 'TRYON_SESSION_ERROR') {
    super(message, code, 400);
    this.name = 'TryOnSessionError';
  }
}

export class SizeRecommendationError extends VTOError {
  constructor(message: string, code: string = 'SIZE_REC_ERROR') {
    super(message, code, 400);
    this.name = 'SizeRecommendationError';
  }
}
