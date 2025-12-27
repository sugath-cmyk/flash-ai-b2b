export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'owner' | 'brand_owner';
  teamId: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface Conversation {
  id: string;
  userId: string;
  teamId: string | null;
  title: string;
  model: string;
  totalTokens: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number;
  model?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  teamId: string | null;
  filename: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  mimeType: string;
  status: 'uploaded' | 'processing' | 'analyzed' | 'error';
  analysisResult?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  ownerId: string;
  subscriptionTier: 'free' | 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'trial';
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}
