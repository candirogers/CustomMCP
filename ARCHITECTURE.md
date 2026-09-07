# MCP Cloud Photos Design System

## Executive Summary

This document defines a **production-ready Model Context Protocol (MCP)** implementation for authenticated cloud photo access. The system enables multiple concurrent sessions to interact with cloud photo libraries (Google Photos, AWS S3, Azure, OneDrive) through a unified interface with sophisticated session management, resilience patterns, and practical policy enforcement.

**Key Guarantees:**
- Multi-session authentication with independent quotas
- Policy compliance built-in (rate limiting, audit logging, consent)
- Resilience patterns for network failures and session recovery
- Gray area workarounds for real-world constraints
- Production security (encrypted credentials, audit trails, minimal scopes)

---

## 1. Core MCP Architecture

### 1.1 Protocol Structure

```
MCP Server
├── Authentication Tools
│   ├── authenticate() - OAuth/credential setup
│   ├── get_auth_status() - Current session state
│   └── revoke_auth() - Logout and token invalidation
├── Photo Operation Tools
│   ├── list_photos() - Paginated photo listing
│   ├── search_photos() - Full-text metadata search
│   ├── get_photo_metadata() - EXIF/labels/location
│   ├── batch_get_metadata() - Multi-photo retrieval
│   └── apply_batch_operation() - Transactional operations
├── Resource Servers
│   ├── photo-metadata - Photo details with caching
│   ├── thumbnails - Efficient thumbnail delivery
│   ├── galleries - Album/collection views
│   ├── audit-logs - Compliance records
│   └── session-state - Quota and session info
└── Capability Declarations
    ├── photos/list - Access to listing
    ├── photos/search - Access to search
    ├── photos/metadata - Read-only metadata
    ├── photos/batch - Batch operations
    └── admin/audit - Audit log access
```

### 1.2 Module Organization

```
src/
├── index.ts                    # MCP server entry point
├── auth/
│   ├── authenticator.ts        # OAuth orchestration
│   ├── credential-vault.ts     # Encrypted storage
│   ├── session-manager.ts      # Multi-session lifecycle
│   ├── token-refresh.ts        # Refresh strategies
│   └── providers/
│       ├── google-photos.ts    # Google Photos provider
│       ├── aws-s3.ts           # AWS S3 provider
│       ├── azure-blob.ts       # Azure Blob provider
│       └── onedrive.ts         # OneDrive provider
├── tools/
│   ├── auth-tools.ts           # Authentication tools
│   ├── photo-list-tools.ts     # Listing operations
│   ├── photo-search-tools.ts   # Search operations
│   └── batch-tools.ts          # Batch operations
├── resources/
│   ├── photo-metadata.ts       # Metadata resources
│   ├── thumbnails.ts           # Thumbnail resources
│   └── audit-logs.ts           # Audit resources
├── cache/
│   ├── cache-manager.ts        # Multi-layer caching
│   ├── memory-cache.ts         # Process memory cache
│   ├── redis-cache.ts          # Redis integration
│   └── database-cache.ts       # Persistent cache
├── policy/
│   ├── rate-limiter.ts         # Rate limiting
│   ├── quota-manager.ts        # Quota tracking
│   ├── audit-logger.ts         # Audit logging
│   ├── consent-manager.ts      # Consent tracking
│   └── policy-validator.ts     # Policy enforcement
├── storage/
│   ├── sql-store.ts            # SQL database layer
│   ├── blob-store.ts           # Blob storage layer
│   └── credential-store.ts     # Credential persistence
├── resilience/
│   ├── circuit-breaker.ts      # Failure isolation
│   ├── exponential-backoff.ts  # Retry logic
│   ├── connection-pool.ts      # Connection pooling
│   └── error-classifier.ts     # Error categorization
├── cli/
│   ├── index.ts                # CLI entry point
│   ├── commands/
│   │   ├── auth.ts             # auth commands
│   │   ├── list.ts             # list commands
│   │   ├── search.ts           # search commands
│   │   ├── batch.ts            # batch commands
│   │   ├── config.ts           # config commands
│   │   └── audit.ts            # audit commands
│   ├── config-loader.ts        # Configuration management
│   ├── interactive-auth.ts     # Browser-based OAuth
│   └── validation.ts           # Input validation
└── types/
    ├── index.ts                # Type definitions
    ├── mcp.ts                  # MCP protocol types
    ├── photo.ts                # Photo data models
    └── auth.ts                 # Authentication types
```

---

## 2. Authentication & Session Management

### 2.1 Multi-Session Strategy

Each authenticated session is **completely isolated** with:
- Independent OAuth tokens and refresh tokens
- Separate rate limit quotas
- Isolated cache entries
- Unique session IDs
- Audit trail per session

```typescript
interface Session {
  sessionId: string;              // UUID
  userId: string;                 // From OAuth provider
  provider: 'google' | 'aws' | 'azure' | 'onedrive';
  accessToken: string;            // Encrypted
  refreshToken: string;           // Encrypted
  tokenExpiry: Date;
  quotaLimit: number;             // ops/hour
  quotaUsed: number;              // ops in current window
  quotaResets: Date;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}
```

### 2.2 Layered Credential Storage

**Three-tier persistence strategy:**

1. **Primary: Encrypted Database** (permanent)
   - AES-256-GCM encryption
   - HMAC integrity verification
   - Hardware security module ready
   - TTL-based automatic cleanup

2. **Secondary: Redis Cache** (24-hour TTL)
   - Fast credential lookup
   - Automatic expiration
   - Cluster-ready
   - Fallback to database on miss

3. **Tertiary: S3/Blob Backup** (disaster recovery)
   - Encrypted snapshot
   - Periodic sync (hourly)
   - Cross-region replication
   - Recovery on database failure

**Encryption Standard:**
```typescript
// Credentials encrypted with:
// - Key: Derived from HSM or vault master key (KDF: Argon2)
// - Cipher: AES-256-GCM
// - AEAD: Authenticated Encryption with Associated Data
// - Nonce: 96-bit random (unique per encryption)
// - Auth Tag: 128-bit (automatically verified on decrypt)

const encrypted = encryptCredential(credential, masterKey);
// Result: { ciphertext, nonce, authTag, algorithm: 'aes-256-gcm' }
```

### 2.3 Token Refresh Strategy

**Three-tier fallback mechanism:**

```
Tier 1: Refresh Token
  ↓ (if failed, try Tier 2)
Tier 2: Implicit Grant (re-authenticate silently)
  ↓ (if failed, try Tier 3)
Tier 3: Token Extension (use existing token with grace period)
  ↓ (if failed, token is invalid)
Force User Re-authentication
```

**Pre-emptive Refresh:**
- Token refreshed at 85% of TTL (prevents mid-operation expiry)
- Background async refresh (non-blocking)
- Exponential backoff on failure (1s, 2s, 4s, 8s, max 30s)
- 24-hour grace period for revoked credentials

**Health Checks:**
- Background task validates credentials every 30 minutes
- Detects revoked/expired tokens early
- Removes stale credentials from cache
- Triggers alert if 10%+ of sessions unhealthy

### 2.4 Session Recovery

After container restart or connection loss:

```
1. Load encrypted sessions from database
2. Validate each session:
   - Token not expired? → Ready
   - Token expired but refresh valid? → Refresh immediately
   - Both expired? → Mark for re-authentication
3. Restore active rate limit windows
4. Resume pending batch operations
5. Log session recovery events
```

---

## 3. Photo Operations Layer

### 3.1 Listing & Filtering

```typescript
interface ListPhotosRequest {
  limit?: number;                 // Default: 50, Max: 1000
  cursor?: string;                // Pagination token
  filter?: {
    dateTaken?: {                  // ISO 8601 range
      from: string;
      to: string;
    };
    mimeType?: string[];           // ['image/jpeg', ...]
    albumId?: string;              // Album/collection ID
    labels?: string[];             // ML-detected labels
    hasLocation?: boolean;
    width?: { min: number; max: number };
    height?: { min: number; max: number };
  };
  fields?: string[];              // Sparse fields
}
```

**Caching Strategy:**
- List queries: **1-5 minute cache** (to catch rapid re-queries)
- Metadata: **1-hour cache** (stable reference data)
- Cache invalidation on:
  - Explicit user operation (tag, delete, move)
  - 24-hour hard expiration
  - Provider webhook notification (if available)

**Lazy Loading:**
- Initial list returns photos with: `id, url, dateTaken, mimeType`
- Metadata fields cached separately and populated on-demand
- `availableFields` flag indicates what's cached vs. must-fetch

### 3.2 Search Operations

```typescript
interface SearchPhotosRequest {
  q: string;                      // Search query (required)
  limit?: number;                 // Default: 50, Max: 500
  cursor?: string;
  searchFields?: string[];        // ['name', 'description', 'labels']
  facets?: boolean;               // Return faceted results
}

interface SearchResult {
  photos: Photo[];
  totalCount: number;
  facets?: {                       // If requested
    labels: { name: string; count: number }[];
    dateRange: { name: string; count: number }[];
    mimeType: { name: string; count: number }[];
  };
  cursor?: string;
}
```

**Two-tier Search:**
1. **Provider Native Search** (Google Photos, OneDrive)
   - Fastest, most accurate
   - Caches results for 30 minutes
   
2. **Fallback Metadata Search** (AWS S3, offline)
   - In-memory index of cached metadata
   - Supports: filename, description, labels
   - Returns approximate results with `confidence: 'full' | 'partial'`

### 3.3 Metadata Retrieval

```typescript
interface Photo {
  id: string;                     // Provider-specific ID
  url: string;                    // HTTPS, time-limited if needed
  thumbnailUrl: string;           // Cached thumbnail
  fileName: string;
  mimeType: string;               // image/jpeg, image/png, etc.
  dateTaken: Date;
  dateCreated: Date;
  dateModified: Date;
  size: number;                   // Bytes
  width: number;
  height: number;
  exif?: {                        // Optional, if requested
    camera: string;
    iso: number;
    focalLength: number;
    aperture: number;
    shutterSpeed: string;
    gps?: {
      latitude: number;
      longitude: number;
      altitude?: number;
      heading?: number;
    };
  };
  labels?: {                      // ML-detected labels
    name: string;
    confidence: 0.0..1.0;
  }[];
  description?: string;
  albums?: string[];
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
}
```

**Batch Metadata Retrieval:**
```typescript
interface BatchMetadataRequest {
  photoIds: string[];             // Max: 100
  fields: string[];               // Sparse: ['exif', 'labels', 'gps']
}

// Internally chunked into 50-photo batches for reliability
// Failed chunks retried with exponential backoff
// Partial results returned with error details
```

### 3.4 Batch Operations

**Transactional Execution:**
```typescript
interface BatchOperation {
  operationId: string;            // UUID for idempotence
  operation: 'tag' | 'remove_tag' | 'move_to_album' | 'archive' | 'delete';
  photoIds: string[];
  parameters: Record<string, any>;
  confirmRequired: boolean;
  
  // Response
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_failed';
  successCount: number;
  failureCount: number;
  errors?: { photoId: string; reason: string }[];
  intent: string;                 // What user intended to do
}
```

**Reliability Pattern:**
- Photos chunked into 50-photo batches
- Each batch retried up to 3 times with exponential backoff
- Partial success accepted (not all-or-nothing)
- Audit logged with full intent and completion details
- Idempotent (same operationId = same result)

---

## 4. CLI Design

### 4.1 Command Structure

```bash
# Authentication
photos auth login                 # Interactive OAuth flow
photos auth status                # Current session info
photos auth refresh               # Force token refresh
photos auth logout                # Revoke and cleanup

# Browsing
photos list [--filter JSON]       # List photos with filters
photos list --filter '{"albumId": "abc"}'
photos search "birthday"          # Full-text search
photos search "after:2024-01-01 camera:Canon"

# Metadata
photos metadata get <id>          # Single photo details
photos metadata batch <id> [<id>] # Multiple photos
photos metadata get <id> --include-exif --include-labels

# Operations
photos batch tag <id> [<id>] [--tag "vacation"]
photos batch move <id> [<id>] [--album "Favorites"]
photos batch archive <id> [<id>]
photos batch delete <id> [<id>] --confirm

# Configuration
photos config set provider google-photos
photos config set rate-limit 1000
photos config get
photos config validate

# Cache Management
photos cache clear              # Clear all caches
photos cache clear --before 2h  # Clear older than 2 hours
photos cache status             # Cache stats and sizes
photos cache prefetch           # Pre-load metadata

# Audit & Compliance
photos audit list               # Recent audit events
photos audit export --format csv --range "7d"
photos audit search "batch_operation"

# System Health
photos health check             # Connection test
photos health status            # Service status
photos health doctor            # Diagnostic report
```

### 4.2 Configuration Management

**Multi-source config loading (in order of precedence):**

1. **Environment Variables** (highest priority)
   ```bash
   PHOTOS_PROVIDER=google-photos
   PHOTOS_RATE_LIMIT=1000
   PHOTOS_CACHE_TTL=3600
   PHOTOS_OFFLINE_MODE=false
   ```

2. **Current Directory** `.photosrc`
   ```json
   {
     "provider": "google-photos",
     "rateLimit": 1000,
     "cacheTtl": 3600,
     "offlineMode": false
   }
   ```

3. **Home Directory** `~/.photosrc` or `~/.photos/config.json`

4. **System Config** `/etc/photos/config.json` (read-only)

5. **Defaults** (lowest priority)
   ```json
   {
     "provider": "google-photos",
     "rateLimit": 100,
     "cacheTtl": 1800,
     "offlineMode": false
   }
   ```

### 4.3 Interactive Authentication

```
$ photos auth login

🔐 Starting authentication flow...

Provider Selection:
  1) Google Photos
  2) AWS S3
  3) Azure Blob
  4) OneDrive
  
Select provider [1]: 1

📱 Opening browser... (or manual URL if browser unavailable)
https://accounts.google.com/o/oauth2/v2/auth?client_id=...

⏱️  Waiting for authorization (5:00 remaining)...

✅ Authorization successful!
📌 Session ID: sess_8f3h2k1j
👤 User: john@example.com
🔑 Token expires: 2026-09-08 12:34:56 UTC

✨ Ready to use!
```

### 4.4 Output Formats

```bash
# Default: Human-readable table
$ photos list
ID         | Name           | Date Taken | Size
-----------|----------------|------------|--------
abc123     | IMG_001.jpg    | 2024-09-01 | 2.5 MB
def456     | IMG_002.jpg    | 2024-09-02 | 3.1 MB

# JSON format (for scripting)
$ photos list --format json
[
  { "id": "abc123", "name": "IMG_001.jpg", ... },
  { "id": "def456", "name": "IMG_002.jpg", ... }
]

# CSV format (for analysis)
$ photos list --format csv
id,name,dateTaken,size
abc123,IMG_001.jpg,2024-09-01,2621440
def456,IMG_002.jpg,2024-09-02,3251200

# Quiet format (scripts)
$ photos list --format quiet
abc123
def456
```

---

## 5. Policy Compliance

### 5.1 Rate Limiting

**Sliding Window Algorithm:**

```
Window: 60 seconds
Limit: 100 operations per session per minute
Per-operation limits:
  - list: 10 ops/min
  - search: 5 ops/min
  - get_metadata: 50 ops/min
  - batch: 2 ops/min

When limit approached:
  - 50% of limit: Log warning
  - 80% of limit: Return quota_approaching in response
  - 100% of limit: Return 429 Too Many Requests with Retry-After
```

**Response Header Format:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 23
X-RateLimit-Reset: 1725000000
Retry-After: 45
```

**Backoff Strategy:**
- Initial backoff: 1 second
- Exponential: multiply by 2 on each retry
- Jitter: add 0-20% random delay to prevent thundering herd
- Max backoff: 30 seconds
- Max retries: 3 attempts

### 5.2 Audit Logging

**Comprehensive Event Tracking:**

```typescript
interface AuditEvent {
  timestamp: Date;
  sessionId: string;
  userId: string;
  provider: string;
  eventType: string;
  
  // Authentication events
  'auth:login' | 'auth:login_failed' | 'auth:logout' | 'auth:token_refresh' |
  'auth:token_refresh_failed' | 'auth:revoked' | 'auth:expired' |
  
  // Data access events
  'data:list_photos' | 'data:search_photos' | 'data:get_metadata' |
  'data:batch_metadata' | 'data:batch_operation' |
  
  // Policy events
  'policy:rate_limit_hit' | 'policy:quota_exceeded' | 'policy:consent_granted' |
  'policy:consent_denied' | 'policy:consent_expired' |
  
  // System events
  'system:error' | 'system:warning' | 'system:health_check' | 'system:recovery';
  
  details: {
    // Common
    success: boolean;
    errorReason?: string;
    
    // Data events
    photoCount?: number;
    fileSize?: number;
    operationType?: string;
    
    // Policy events
    quotaUsed?: number;
    quotaLimit?: number;
    consentType?: string;
  };
  
  ipAddress: string;                // For security analysis
  userAgent?: string;
  requestId: string;                // For request tracing
}
```

**Queryable Interface:**
```bash
photos audit list                   # Last 100 events
photos audit list --limit 1000      # Configurable limit
photos audit list --session sess_abc123  # Filter by session
photos audit list --user john@example.com
photos audit list --range "7d"      # Last 7 days
photos audit list --event "auth:*"  # Event type pattern matching
photos audit export --format json   # For compliance systems
```

**Retention Policy:**
- Authentication events: 2 years (compliance requirement)
- Data access events: 1 year
- System events: 90 days
- Automatic cleanup (don't retain more than necessary)
- Export to immutable blob storage for cold archive

### 5.3 Consent Management

**Explicit Consent for Operations:**

```typescript
interface ConsentGrant {
  grantId: string;
  sessionId: string;
  operationType: string;          // 'list', 'search', 'metadata', 'batch_tag', etc.
  grantedAt: Date;
  expiresAt: Date;
  scope: 'once' | '30days' | 'unlimited';
  userConfirmed: boolean;
}
```

**Consent Prompts (interactive):**
```
⚠️  This operation requires consent:

Operation: Batch tag 150 photos
Impact: Will add tags to your photos
Scope: Once per session

☐ Confirm this operation
☐ Allow for 30 days (expires 2026-10-07)
☐ Always allow (unlimited)

[Continue] [Cancel]
```

**Programmatic Consent (non-interactive):**
- Accept `--consent` flag with scope
- Skip prompt if valid grant exists
- Audit all consent decisions
- Detect suspicious patterns (many denials, rapid grants)

### 5.4 Quota Management

**Per-Session Quotas:**

```
Configuration:
  operations_per_hour: 5000 (default)
  operations_per_day: 50000
  batch_size_max: 100
  
Tracking (sliding window):
  Current window: 11:45-12:45 UTC
  Operations used: 3847
  Operations remaining: 1153
  Resets in: 15 minutes
  
Daily tracking:
  Used: 12500 / 50000
  Percentage: 25%
```

**Quota Enforcement:**
- Check before each operation
- Return quota info with every response
- Implement per-operation limits (batch: 2/min)
- Distribute quota across multiple sessions (if pooling enabled)
- Daily reset at midnight UTC

---

## 6. Gray Area Workarounds

### 6.1 Credential Storage & Rotation

**Challenge:** Rate limiting on credential refresh, token revocation detection delay

**Workaround:**

```typescript
// Multi-layer caching with intelligent refresh

class CredentialVault {
  async getCredential(sessionId: string): Promise<Credential> {
    // Layer 1: Process memory (expires 60 seconds)
    const memCached = this.memoryCache.get(sessionId);
    if (memCached && !memCached.isExpired()) {
      return memCached;
    }
    
    // Layer 2: Redis (expires 24 hours)
    const redisCached = await this.redis.get(`cred:${sessionId}`);
    if (redisCached && !redisCached.isExpired()) {
      this.memoryCache.set(sessionId, redisCached);
      return redisCached;
    }
    
    // Layer 3: Encrypted database (permanent with TTL cleanup)
    const dbCred = await this.database.getCredential(sessionId);
    if (dbCred && !dbCred.isExpired()) {
      await this.redis.set(`cred:${sessionId}`, dbCred, { ttl: '24h' });
      this.memoryCache.set(sessionId, dbCred);
      return dbCred;
    }
    
    // Layer 4: Backup recovery from S3
    const backupCred = await this.blobStorage.recoverCredential(sessionId);
    if (backupCred) {
      // Re-establish in primary storage
      await this.database.saveCredential(backupCred);
      await this.redis.set(`cred:${sessionId}`, backupCred, { ttl: '24h' });
      return backupCred;
    }
    
    throw new CredentialNotFound(sessionId);
  }
  
  // Async background refresh (non-blocking)
  async refreshTokenBackground(sessionId: string): Promise<void> {
    const cred = await this.getCredential(sessionId);
    const refreshedCred = await this.refreshToken(cred);
    
    // Update all layers
    this.memoryCache.set(sessionId, refreshedCred);
    await this.redis.set(`cred:${sessionId}`, refreshedCred, { ttl: '24h' });
    await this.database.saveCredential(refreshedCred);
  }
}
```

**Refresh Retry Strategy:**
- Try refresh token (fastest)
- If rate-limited or failed, try implicit grant
- If both fail, extend grace period on existing token
- Log all attempts for diagnostics

### 6.2 Session Persistence & Recovery

**Challenge:** Container restarts, network disconnections, session timeouts

**Workaround:**

```typescript
// Distributed session checkpointing

class SessionManager {
  async saveSession(session: Session): Promise<void> {
    const encrypted = encryptSession(session);
    
    // Parallel writes to all layers
    await Promise.all([
      this.database.save(encrypted),
      this.redis.set(`session:${session.sessionId}`, encrypted, { ttl: '7d' }),
      this.blobStorage.backup(encrypted, `session-backup/${session.sessionId}`),
    ]);
  }
  
  async recoverSession(sessionId: string): Promise<Session> {
    try {
      // Try primary (fastest)
      return await this.database.get(sessionId);
    } catch (e1) {
      console.warn(`Database get failed: ${e1.message}, trying Redis...`);
      try {
        // Try cache (fallback 1)
        return await this.redis.get(`session:${sessionId}`);
      } catch (e2) {
        console.warn(`Redis get failed: ${e2.message}, trying backup...`);
        // Try backup (fallback 2)
        return await this.blobStorage.restore(sessionId);
      }
    }
  }
  
  // Graceful recovery on restart
  async restoreAllSessions(): Promise<Session[]> {
    const sessions = [];
    const dbSessions = await this.database.getAllSessions();
    
    for (const session of dbSessions) {
      try {
        // Validate session
        if (session.tokenExpiry > new Date()) {
          sessions.push(session);
        } else if (session.refreshToken) {
          // Try to refresh expired token
          const refreshed = await this.refreshSession(session);
          sessions.push(refreshed);
        } else {
          // Mark for re-authentication
          console.warn(`Session ${session.sessionId} requires re-auth`);
          session.requiresReauth = true;
          sessions.push(session);
        }
      } catch (error) {
        console.error(`Failed to restore session ${session.sessionId}: ${error}`);
        // Partial recovery - log but continue
      }
    }
    
    return sessions;
  }
}
```

**Connection Health Checks:**
```typescript
// Every 30 minutes, validate session connections

async function healthCheckLoop() {
  const sessions = await sessionManager.getAllActiveSessions();
  
  for (const session of sessions) {
    try {
      const status = await provider.checkConnection(session);
      if (!status.healthy) {
        console.warn(`Session ${session.sessionId} connection unhealthy: ${status.reason}`);
        // Trigger refresh or mark for recovery
        await sessionManager.markForRecovery(session.sessionId);
      }
    } catch (error) {
      // Soft failure - don't crash health check
      console.error(`Health check failed for session: ${error}`);
    }
  }
}
```

### 6.3 Rate Limits & Quota Management

**Challenge:** API rate limits, quota exhaustion, fairness across sessions

**Workaround:**

```typescript
// Predictive tracking and priority queuing

class RateLimitManager {
  async executeWithBackoff<T>(
    fn: () => Promise<T>,
    operationType: string,
    sessionId: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    const quotaStatus = this.getQuotaStatus(sessionId, operationType);
    
    // Predictive rejection (before hitting hard limit)
    if (quotaStatus.percentUsed > 0.8) {
      throw new QuotaApproachingError({
        remaining: quotaStatus.remaining,
        resets: quotaStatus.resetsAt,
        recommendation: 'wait_or_use_different_session'
      });
    }
    
    // Priority queue (high priority operations go first)
    await this.waitInQueue(priority);
    
    // Exponential backoff with jitter
    let backoffMs = 1000;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error: any) {
        lastError = error;
        
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          const waitTime = error.retryAfterSeconds || Math.ceil(backoffMs / 1000);
          const jitter = Math.random() * 0.2 * backoffMs;
          await sleep(backoffMs + jitter);
          backoffMs = Math.min(backoffMs * 2, 30000); // Max 30 seconds
        } else if (attempt < 3) {
          // For other errors, still retry but with shorter backoff
          await sleep(backoffMs * (attempt / 3) + Math.random() * 1000);
        }
      }
    }
    
    throw lastError || new Error(`Failed after ${3} retries`);
  }
  
  // Quota pooling for multiple sessions
  async poolQuotasForOperation(
    operation: string,
    sessionIds: string[]
  ): Promise<string | null> {
    // Find session with available quota
    for (const sessionId of sessionIds) {
      const quota = this.getQuotaStatus(sessionId, operation);
      if (quota.remaining > 0) {
        return sessionId;
      }
    }
    return null;
  }
}
```

**Predictive Tracking:**
```
Parse rate-limit headers from API:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 23
  X-RateLimit-Reset: 1725000000

Anticipate quota exhaustion:
  - Current rate: 5 ops/min
  - Remaining: 23
  - Time until exhaustion: 4.6 minutes
  - Recommendation: Delay high-volume operations
```

### 6.4 Offline-First Patterns

**Challenge:** Intermittent connectivity, need to queue changes locally

**Workaround:**

```typescript
// Write-through cache with conflict resolution

class OfflineQueue {
  async executeOperation(
    op: PhotoOperation,
    metadata?: { offline?: boolean }
  ): Promise<OperationResult> {
    if (!this.isOnline()) {
      // Queue locally
      const queuedOp = await this.localQueue.add(op);
      return {
        status: 'queued_offline',
        operationId: queuedOp.id,
        message: 'Operation queued. Will sync when online.'
      };
    }
    
    try {
      const result = await this.executeRemote(op);
      // Also update local cache
      await this.localCache.invalidate(op.affectedPhotoIds);
      return result;
    } catch (error) {
      if (this.isNetworkError(error)) {
        // Queue for retry
        await this.localQueue.add(op);
        return {
          status: 'network_error_queued',
          operationId: op.id,
          message: 'Connection lost. Queued for retry.'
        };
      }
      throw error;
    }
  }
  
  // Sync queued operations when back online
  async syncQueuedOperations(): Promise<SyncResult> {
    const queued = await this.localQueue.getAll();
    const results = {
      synced: 0,
      failed: 0,
      conflicts: [] as ConflictResolution[]
    };
    
    for (const op of queued) {
      try {
        // Check if server version has changed
        const serverVersion = await this.checkServerVersion(op.photoIds);
        
        if (serverVersion.hasChanged) {
          // Conflict detected
          const resolution = await this.resolveConflict(op, serverVersion);
          results.conflicts.push(resolution);
        } else {
          // Safe to replay
          await this.executeRemote(op);
          await this.localQueue.remove(op.id);
          results.synced++;
        }
      } catch (error) {
        results.failed++;
        // Keep in queue for next sync attempt
        console.error(`Sync failed for operation ${op.id}: ${error}`);
      }
    }
    
    return results;
  }
}

// Conflict resolution strategies
enum ConflictResolution {
  USE_LOCAL,          // Keep user's local changes
  USE_SERVER,         // Discard and use server version
  MERGE,              // Combine both (if possible)
  MANUAL_REVIEW       // Ask user
}
```

**Aggressive Prefetching:**
```typescript
// Background task pre-loads data for offline use

async function prefetchMetadata() {
  const recentPhotos = await listPhotos({ limit: 500 });
  
  for (const batch of chunk(recentPhotos, 50)) {
    await batchGetMetadata(batch, {
      fields: ['exif', 'labels', 'gps'],
      cache: true,
      background: true  // Don't block foreground operations
    });
  }
  
  // Also cache last search results
  await cacheSearchResults();
}

// Schedule: Every 6 hours or on startup
setInterval(prefetchMetadata, 6 * 60 * 60 * 1000);
```

### 6.5 Error Recovery & Circuit Breaker

**Challenge:** Cascading failures, infinite retry loops, resource exhaustion

**Workaround:**

```typescript
// Intelligent error classification and recovery

class ErrorClassifier {
  classify(error: any): ErrorCategory {
    if (error.status === 429) {
      return ErrorCategory.RATE_LIMITED;  // Backoff and retry
    }
    if (error.status === 401 || error.status === 403) {
      return ErrorCategory.AUTH_FAILED;   // Re-authenticate
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return ErrorCategory.NETWORK_ERROR; // Retry with backoff
    }
    if (error.status >= 500) {
      return ErrorCategory.SERVER_ERROR;  // Exponential backoff
    }
    if (error.status === 400 || error.status === 404) {
      return ErrorCategory.BAD_REQUEST;   // Fail immediately
    }
    return ErrorCategory.UNKNOWN;
  }
  
  getRecoveryAction(error: any): RecoveryAction {
    const category = this.classify(error);
    
    return {
      [ErrorCategory.RATE_LIMITED]: {
        action: 'backoff_and_retry',
        delayMs: error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : 1000,
        maxRetries: 5
      },
      [ErrorCategory.AUTH_FAILED]: {
        action: 'refresh_token_or_reauth',
        delayMs: 0,
        maxRetries: 1
      },
      [ErrorCategory.NETWORK_ERROR]: {
        action: 'exponential_backoff_retry',
        delayMs: 1000,
        maxRetries: 3
      },
      [ErrorCategory.SERVER_ERROR]: {
        action: 'exponential_backoff_retry',
        delayMs: 2000,
        maxRetries: 3
      },
      [ErrorCategory.BAD_REQUEST]: {
        action: 'fail_immediately',
        delayMs: 0,
        maxRetries: 0
      }
    }[category];
  }
}

// Circuit breaker for provider endpoints

class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime!.getTime();
      if (timeSinceFailure > 60000) {
        // Try to recover
        this.state = 'half_open';
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker open. Retry after ${60000 - timeSinceFailure}ms`
        );
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'half_open') {
        // Recovery successful
        this.state = 'closed';
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = new Date();
      
      if (this.failureCount >= 5) {
        // Too many failures, open circuit
        this.state = 'open';
      }
      
      throw error;
    }
  }
}
```

---

## 7. Security Considerations

### 7.1 Credential Security

- **Never log credentials** - Scrub before any logging
- **Timing-safe comparison** - Prevent timing attacks on token validation
- **AES-256-GCM** - AEAD cipher for authenticated encryption
- **Unique nonces** - 96-bit random nonce per encryption
- **Minimal scopes** - Request only necessary OAuth scopes
- **HSM integration** - Optional hardware security module for key storage
- **Audit trail** - Log all credential operations

### 7.2 Data Privacy

- **Encrypted in transit** - TLS 1.3 minimum
- **Encrypted at rest** - Database field-level encryption
- **Ephemeral tokens** - Short TTLs on temporary credentials
- **Cache policy** - Metadata cached, credentials never cached in plain text
- **Export sanitization** - Scrub sensitive data from exports
- **GDPR compliance** - Support for data subject rights requests

### 7.3 Access Control

- **Session isolation** - Users cannot access other sessions' data
- **Provider scoping** - Credentials scoped to specific provider/account
- **Least privilege** - Minimal OAuth scopes, read-only by default
- **Rate limiting** - Per-session quotas prevent abuse
- **Audit logging** - Full compliance trail

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Project setup (TypeScript, Node.js, dependencies)
- MCP protocol implementation
- Basic authentication framework
- Credential vault with encryption
- Unit tests

### Phase 2: Core Operations (Weeks 3-4)
- Photo listing and filtering
- Metadata retrieval
- Caching layer (memory + Redis)
- Rate limiting and quotas
- Resource server implementation

### Phase 3: CLI & Configuration (Weeks 5-6)
- CLI scaffolding with all commands
- Configuration loader
- Interactive auth flow
- Input validation
- Output formatting (table, JSON, CSV)

### Phase 4: Resilience & Workarounds (Weeks 7-8)
- Circuit breaker and error recovery
- Offline queue and sync
- Session persistence and recovery
- Multi-layer credential caching
- Health checks and diagnostics

### Phase 5: Polish & Deployment (Weeks 9-10)
- Security audit
- Performance testing
- Documentation
- Integration tests
- Deployment guides

---

## 9. Success Criteria

- ✅ Multi-session support with isolated quotas
- ✅ 99.9% authentication success rate (handling failures gracefully)
- ✅ Sub-100ms response time for cached queries
- ✅ Support for 4+ cloud providers
- ✅ Full audit trail for compliance
- ✅ Zero credential leaks (automated scanning)
- ✅ Graceful handling of network disconnections
- ✅ CLI commands for all major operations
- ✅ Policy enforcement (rate limits, consent, quotas)
- ✅ Comprehensive error recovery

---

## Appendix: Glossary

| Term | Definition |
|------|-----------|
| **MCP** | Model Context Protocol - standardized protocol for LLM context |
| **Session** | Authenticated context with independent token and quota |
| **Provider** | Cloud storage service (Google Photos, AWS S3, etc.) |
| **Quota** | Per-session operation limit (e.g., 5000 ops/hour) |
| **Rate Limit** | Per-operation limit (e.g., 10 list ops/min) |
| **Grace Period** | Time to use token after expiration before requiring re-auth |
| **Circuit Breaker** | Pattern to stop calling failing service and recover |
| **Offline Queue** | Local storage for operations when offline |
| **Conflict Resolution** | Strategy for handling offline changes vs. server state |

