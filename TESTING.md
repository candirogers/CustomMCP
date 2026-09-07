# Testing Strategy: MCP Cloud Photos System

## Overview

This document defines the comprehensive testing strategy for validating:
1. **Unit Tests** - Individual components (logger, types, server, CLI)
2. **Integration Tests** - Component interactions (auth → session → quota)
3. **E2E Tests** - Full workflows (login → list → batch → audit)
4. **Policy Tests** - Rate limiting, quota, consent enforcement
5. **Resilience Tests** - Error recovery, offline scenarios, failover

---

## Test Organization

```
tests/
├── unit/                        # Component tests
│   ├── utils/                   # Logger, helpers
│   ├── types/                   # Type validation
│   ├── mcp/                     # Server components
│   └── cli/                     # CLI commands
├── integration/                 # Component interactions
│   ├── auth/                    # Auth + session + credential flow
│   ├── operations/              # Photo ops + caching + rate limiting
│   └── batch/                   # Batch operations + audit logging
├── e2e/                         # Full workflows
│   ├── auth-flow.e2e.test.ts   # Login to ready state
│   ├── photo-operations.e2e.test.ts
│   ├── batch-operations.e2e.test.ts
│   ├── offline-sync.e2e.test.ts
│   └── resilience.e2e.test.ts
├── fixtures/                    # Test data
│   ├── photos.ts                # Mock photo data
│   ├── sessions.ts              # Mock sessions
│   └── responses.ts             # Mock API responses
├── mocks/                       # Mock implementations
│   ├── google-photos.ts
│   ├── aws-s3.ts
│   ├── credential-vault.ts
│   └── cache-manager.ts
└── setup.ts                     # Test environment setup
```

---

## Test Categories & Execution

### Category 1: Unit Tests (Fast, ~50ms each)
```bash
photos test:unit                # All unit tests
photos test:unit --grep logger  # Specific test
```

**Components:**
- Logger (✓ minimal, fast)
- Type system (✓ type checking)
- Error classification (✓ logic)
- Config validation (✓ parsing)

**Parallelizable:** ✅ Yes (no shared state)

### Category 2: Integration Tests (Medium, ~500ms each)
```bash
photos test:integration          # All integration tests
photos test:integration --grep auth
```

**Scenarios:**
- Authentication flow (mock provider)
- Session management (create, refresh, revoke)
- Rate limiting (quota tracking)
- Caching behavior (L1, L2, L3)
- Audit logging

**Parallelizable:** ⚠️ Partially (shared mock database)

### Category 3: E2E Tests (Slow, ~2-5s each)
```bash
photos test:e2e                 # All E2E tests
photos test:e2e --grep "offline-sync"
```

**Full Workflows:**
1. **Auth Flow** - Login → token → session ready
2. **Photo Operations** - List → search → metadata → offline
3. **Batch Operations** - Tag → move → delete with audit
4. **Offline Sync** - Queue offline → go online → sync conflicts
5. **Resilience** - Rate limit → backoff → circuit breaker recovery

**Parallelizable:** ⚠️ Partially (needs isolated mock servers)

### Category 4: Policy Tests (Critical)
```bash
photos test:policy              # All policy enforcement
```

**Validations:**
- Rate limits enforced (429 responses)
- Quotas tracked (per-session, per-hour)
- Consent required (explicit approval)
- Audit trail complete (all events logged)
- Consent grants expire (time-based)

**Parallelizable:** ✅ Yes

### Category 5: Resilience Tests (Critical)
```bash
photos test:resilience          # All resilience scenarios
```

**Scenarios:**
- Token expiration handling
- Connection loss + recovery
- Credential refresh fallback
- Circuit breaker open/close
- Offline queue sync conflicts
- Container restart recovery

**Parallelizable:** ✅ Yes

---

## Test Execution Strategy

### Serial Execution (Baseline)
```bash
npm test                        # ~30 seconds total
```

### Parallel Execution (Recommended)
```bash
npm run test:parallel           # ~10 seconds (3x speedup)
# Runs 3 parallel test suites
```

### Agent Parallel Execution (Max Speed)
```bash
npm run test:agent-parallel     # Spawn agents for each test category
# Each agent runs one category in parallel
```

---

## Mock Strategy

### Mock Providers
Each provider has a mock implementation with configurable behavior:

```typescript
// Example: Google Photos mock
class MockGooglePhotos {
  // Simulates real API responses
  async listPhotos(opts: ListPhotosRequest): Promise<Photo[]> {
    // Return 50 photos
  }
  
  // Can inject failures for resilience testing
  async refreshToken(): Promise<void> {
    if (this.failNextRefresh) {
      throw new Error('401 Unauthorized');
    }
  }
  
  // Can track call history
  callHistory: Array<{ method: string; args: any }> = [];
}
```

### Mock Database
- In-memory SQLite for tests
- Auto-reset between tests
- Configurable data
- Transaction support

### Mock Cache
- Mock Redis client
- In-memory storage
- TTL enforcement
- Statistics tracking

---

## Test Fixtures

### Photo Fixtures
```typescript
// 100 photos across different dates, mimetypes, locations
const mockPhotos = [
  {
    id: 'photo_001',
    fileName: 'IMG_001.jpg',
    dateTaken: new Date('2024-09-01'),
    mimeType: 'image/jpeg',
    width: 4000,
    height: 3000,
    labels: ['vacation', 'beach'],
  },
  // ... 99 more
];
```

### Session Fixtures
```typescript
// Fully authenticated session ready for operations
const mockSession: Session = {
  sessionId: 'sess_test_001',
  userId: 'test@example.com',
  provider: 'google',
  accessToken: 'encr_token_xyz', // Mock encrypted
  refreshToken: 'encr_refresh_xyz',
  tokenExpiry: new Date(Date.now() + 3600000),
  quotaLimit: 100,
  quotaUsed: 0,
  quotaResets: new Date(Date.now() + 3600000),
  createdAt: new Date(),
  lastActivity: new Date(),
};
```

---

## Example Tests

### Unit Test: Logger
```typescript
describe('Logger', () => {
  it('should format messages with timestamp', () => {
    const logger = new Logger();
    const output = logger.formatMessage('INFO', 'Test message', { key: 'value' });
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    expect(output).toContain('INFO');
    expect(output).toContain('Test message');
  });

  it('should respect log level', () => {
    const logger = new Logger();
    logger.setLevel(LogLevel.ERROR);
    const debugSpy = spyOn(console, 'debug');
    logger.debug('Should not log');
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
```

### Integration Test: Authentication
```typescript
describe('Authentication Flow', () => {
  let vault: CredentialVault;
  let mockProvider: MockGooglePhotos;
  let sessionManager: SessionManager;

  beforeEach(() => {
    vault = new CredentialVault(new MockDatabase());
    mockProvider = new MockGooglePhotos();
    sessionManager = new SessionManager(vault);
  });

  it('should authenticate and create session', async () => {
    const credential = await mockProvider.authenticate({
      clientId: 'test_client',
      redirectUri: 'http://localhost:3000/callback',
    });

    const session = await sessionManager.createSession({
      userId: 'test@example.com',
      provider: 'google',
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
    });

    expect(session.sessionId).toBeDefined();
    expect(session.quotaLimit).toBeGreaterThan(0);
    expect(session.tokenExpiry).toBeGreaterThan(new Date());
  });

  it('should refresh expired token', async () => {
    const session = createMockSession({ tokenExpiry: new Date() });
    const refreshed = await sessionManager.refreshSession(session);

    expect(refreshed.accessToken).not.toBe(session.accessToken);
    expect(refreshed.tokenExpiry).toBeGreaterThan(new Date());
  });
});
```

### E2E Test: Full Auth Flow
```typescript
describe('E2E: Authentication Flow', () => {
  it('should complete full login → ready workflow', async () => {
    // Step 1: Start OAuth flow
    const authUrl = await mcp.startOAuth({
      provider: 'google-photos',
      scopes: ['photos.readonly'],
    });
    expect(authUrl).toMatch(/https:\/\/accounts.google.com/);

    // Step 2: Simulate callback
    const callbackCode = 'auth_code_xyz';
    const credential = await mcp.handleOAuthCallback(callbackCode);
    expect(credential.accessToken).toBeDefined();

    // Step 3: Create session
    const session = await mcp.createSession(credential);
    expect(session.sessionId).toBeDefined();

    // Step 4: Verify ready state
    const status = await mcp.getSessionStatus(session.sessionId);
    expect(status.authenticated).toBe(true);
    expect(status.quotaRemaining).toBeGreaterThan(0);
  });
});
```

### Policy Test: Rate Limiting
```typescript
describe('Policy: Rate Limiting', () => {
  it('should enforce per-operation rate limit', async () => {
    const limiter = new RateLimiter({ listLimit: 10 });
    const session = createMockSession();

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      await expect(limiter.checkLimit(session, 'list')).resolves.not.toThrow();
    }

    // 11th should fail with 429
    await expect(limiter.checkLimit(session, 'list')).rejects.toThrow(
      expect.objectContaining({ status: 429 })
    );
  });

  it('should return quota info in response', async () => {
    const limiter = new RateLimiter();
    const session = createMockSession({ quotaUsed: 50, quotaLimit: 100 });

    const quotaInfo = limiter.getQuotaStatus(session);
    expect(quotaInfo.percentUsed).toBe(50);
    expect(quotaInfo.remaining).toBe(50);
  });
});
```

### Resilience Test: Offline Sync
```typescript
describe('Resilience: Offline Sync', () => {
  it('should queue operations when offline', async () => {
    const queue = new OfflineQueue(mockDatabase);
    const network = new MockNetwork({ online: false });

    const result = await queue.executeOperation({
      operation: 'tag',
      photoIds: ['photo_001'],
      tag: 'vacation',
    });

    expect(result.status).toBe('queued_offline');
    expect(result.operationId).toBeDefined();
  });

  it('should sync queued operations when back online', async () => {
    const queue = new OfflineQueue(mockDatabase);
    const network = new MockNetwork({ online: false });

    // Queue while offline
    const op1 = await queue.executeOperation({ /* ... */ });
    expect(op1.status).toBe('queued_offline');

    // Go back online
    network.online = true;
    const syncResult = await queue.syncQueuedOperations();

    expect(syncResult.synced).toBe(1);
    expect(syncResult.failed).toBe(0);
  });

  it('should resolve conflicts on sync', async () => {
    const queue = new OfflineQueue(mockDatabase);

    // User modifies photo offline
    const queuedOp = await queue.queueOperation({ tag: 'local-tag' });

    // Meanwhile, server has different version
    mockProvider.serverPhotos[0].tags = ['server-tag'];

    // Sync should detect conflict
    const conflict = await queue.detectConflict(queuedOp);
    expect(conflict).toBeDefined();
    expect(conflict.strategy).toBe('manual_review'); // Default for tag conflicts
  });
});
```

---

## Test Coverage Goals

| Component | Unit | Integration | E2E | Target |
|-----------|------|-------------|-----|--------|
| Logger | ✅ | - | - | 100% |
| Types | ✅ | - | - | 100% |
| Auth | ✅ | ✅ | ✅ | 95% |
| Session Manager | ✅ | ✅ | ✅ | 95% |
| Rate Limiter | ✅ | ✅ | - | 90% |
| Cache Manager | ✅ | ✅ | - | 90% |
| CLI Commands | ✅ | ✅ | ✅ | 85% |
| Audit Logger | ✅ | ✅ | - | 90% |
| Error Handling | ✅ | ✅ | ✅ | 95% |

**Overall Target: 90%+ coverage**

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run test:unit
      
  integration:
    runs-on: ubuntu-latest
    services:
      postgres: # if using real DB
        image: postgres:15
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run test:integration
      
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run test:e2e
      
  policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run test:policy
```

---

## Running Tests

### Development
```bash
# Watch mode
npm run test:watch

# Single file
npm test -- src/utils/logger.test.ts

# With coverage
npm run test:coverage
```

### CI/CD
```bash
# All tests (serial)
npm test

# Parallel (faster)
npm run test:parallel

# Specific category
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:policy
npm run test:resilience
```

### Agent-Parallel (Maximum Speed)
```bash
# Spawn agents for each category
npm run test:agent-parallel
# Expected: ~10-15 seconds for full suite
```

---

## Success Criteria

✅ **100% of unit tests passing**
✅ **100% of integration tests passing**
✅ **100% of E2E tests passing**
✅ **100% of policy tests passing**
✅ **100% of resilience tests passing**
✅ **90%+ code coverage**
✅ **All type checks passing**
✅ **All linting passing**
✅ **No console errors/warnings**

---

## Debugging Tests

### Enable verbose logging
```bash
DEBUG=* npm test
```

### Run single test
```bash
npm test -- --grep "should authenticate and create session"
```

### Debug in VS Code
```json
{
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/mocha",
  "args": ["--require ts-node/register", "tests/**/*.test.ts"],
  "console": "integratedTerminal"
}
```

