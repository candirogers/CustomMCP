// Core type definitions for the MCP Cloud Photos system

export interface Session {
  sessionId: string;
  userId: string;
  provider: 'google' | 'aws' | 'azure' | 'onedrive';
  accessToken: string; // Encrypted
  refreshToken: string; // Encrypted
  tokenExpiry: Date;
  quotaLimit: number; // ops/hour
  quotaUsed: number;
  quotaResets: Date;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
  requiresReauth?: boolean;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string;
  dateTaken: Date;
  dateCreated: Date;
  dateModified: Date;
  size: number; // Bytes
  width: number;
  height: number;
  exif?: {
    camera?: string;
    iso?: number;
    focalLength?: number;
    aperture?: number;
    shutterSpeed?: string;
    gps?: {
      latitude: number;
      longitude: number;
      altitude?: number;
      heading?: number;
    };
  };
  labels?: { name: string; confidence: number }[];
  description?: string;
  albums?: string[];
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
}

export interface PhotoListRequest {
  limit?: number; // Default: 50, Max: 1000
  cursor?: string;
  filter?: {
    dateTaken?: { from: string; to: string };
    mimeType?: string[];
    albumId?: string;
    labels?: string[];
    hasLocation?: boolean;
    width?: { min: number; max: number };
    height?: { min: number; max: number };
  };
  fields?: string[];
}

export interface PhotoListResponse {
  photos: Photo[];
  cursor?: string;
  totalCount?: number;
}

export interface SearchPhotosRequest {
  q: string;
  limit?: number; // Default: 50, Max: 500
  cursor?: string;
  searchFields?: string[];
  facets?: boolean;
}

export interface SearchResult {
  photos: Photo[];
  totalCount: number;
  facets?: {
    labels: { name: string; count: number }[];
    dateRange: { name: string; count: number }[];
    mimeType: { name: string; count: number }[];
  };
  cursor?: string;
}

export interface BatchMetadataRequest {
  photoIds: string[];
  fields: string[];
}

export interface BatchOperationRequest {
  operationId?: string;
  operation: 'tag' | 'remove_tag' | 'move_to_album' | 'archive' | 'delete';
  photoIds: string[];
  parameters: Record<string, any>;
  confirmRequired?: boolean;
}

export interface BatchOperationResponse {
  operationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_failed';
  successCount: number;
  failureCount: number;
  errors?: { photoId: string; reason: string }[];
  intent?: string;
}

export interface AuditEvent {
  timestamp: Date;
  sessionId: string;
  userId: string;
  provider: string;
  eventType: string;
  success: boolean;
  errorReason?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
}

export interface ConsentGrant {
  grantId: string;
  sessionId: string;
  operationType: string;
  grantedAt: Date;
  expiresAt: Date;
  scope: 'once' | '30days' | 'unlimited';
  userConfirmed: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  percentUsed: number;
}

export interface QuotaStatus {
  limit: number;
  used: number;
  percentUsed: number;
  remaining: number;
  resetsAt: Date;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable?: boolean;
  retryAfterMs?: number;
}

export enum ErrorCategory {
  RATE_LIMITED = 'rate_limited',
  AUTH_FAILED = 'auth_failed',
  NETWORK_ERROR = 'network_error',
  SERVER_ERROR = 'server_error',
  BAD_REQUEST = 'bad_request',
  UNKNOWN = 'unknown'
}

export interface RecoveryAction {
  action: 'backoff_and_retry' | 'refresh_token_or_reauth' | 'exponential_backoff_retry' | 'fail_immediately';
  delayMs: number;
  maxRetries: number;
}
