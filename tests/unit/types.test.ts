/**
 * Unit Tests: Type Definitions
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import type {
  Session,
  Photo,
  PhotoListRequest,
  BatchOperationRequest,
  AuditEvent,
  RateLimitInfo,
} from '../../src/types/index.js';

describe('Type Definitions', () => {
  describe('Session Type', () => {
    it('should have required session properties', () => {
      const session: Session = {
        sessionId: 'sess_test_001',
        userId: 'test@example.com',
        provider: 'google',
        accessToken: 'token_xyz',
        refreshToken: 'refresh_xyz',
        tokenExpiry: new Date(Date.now() + 3600000),
        quotaLimit: 100,
        quotaUsed: 0,
        quotaResets: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: {},
      };

      assert.strictEqual(session.sessionId, 'sess_test_001');
      assert.strictEqual(session.provider, 'google');
      assert.ok(session.tokenExpiry instanceof Date);
    });

    it('should support provider union types', () => {
      const providers: Array<'google' | 'aws' | 'azure' | 'onedrive'> = [
        'google',
        'aws',
        'azure',
        'onedrive',
      ];

      assert.strictEqual(providers.length, 4);
    });
  });

  describe('Photo Type', () => {
    it('should have required photo properties', () => {
      const photo: Photo = {
        id: 'photo_001',
        url: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        fileName: 'IMG_001.jpg',
        mimeType: 'image/jpeg',
        dateTaken: new Date('2024-09-01'),
        dateCreated: new Date('2024-09-01'),
        dateModified: new Date('2024-09-01'),
        size: 2621440, // 2.5 MB
        width: 4000,
        height: 3000,
      };

      assert.strictEqual(photo.id, 'photo_001');
      assert.strictEqual(photo.mimeType, 'image/jpeg');
      assert.strictEqual(photo.width, 4000);
    });

    it('should support optional EXIF data', () => {
      const photo: Photo = {
        id: 'photo_001',
        url: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        fileName: 'IMG_001.jpg',
        mimeType: 'image/jpeg',
        dateTaken: new Date(),
        dateCreated: new Date(),
        dateModified: new Date(),
        size: 1000,
        width: 1920,
        height: 1080,
        exif: {
          camera: 'Canon EOS 5D',
          iso: 400,
          focalLength: 50,
          aperture: 2.8,
          shutterSpeed: '1/125',
          gps: {
            latitude: 40.7128,
            longitude: -74.006,
            altitude: 10,
            heading: 180,
          },
        },
      };

      assert.ok(photo.exif);
      assert.strictEqual(photo.exif.camera, 'Canon EOS 5D');
      assert.ok(photo.exif.gps);
      assert.strictEqual(photo.exif.gps.latitude, 40.7128);
    });

    it('should support ML labels', () => {
      const photo: Photo = {
        id: 'photo_001',
        url: 'https://example.com/photo.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        fileName: 'IMG_001.jpg',
        mimeType: 'image/jpeg',
        dateTaken: new Date(),
        dateCreated: new Date(),
        dateModified: new Date(),
        size: 1000,
        width: 1920,
        height: 1080,
        labels: [
          { name: 'vacation', confidence: 0.95 },
          { name: 'beach', confidence: 0.87 },
        ],
      };

      assert.ok(photo.labels);
      assert.strictEqual(photo.labels.length, 2);
      assert.strictEqual(photo.labels[0].confidence, 0.95);
    });
  });

  describe('PhotoListRequest Type', () => {
    it('should support filter with date range', () => {
      const request: PhotoListRequest = {
        limit: 50,
        filter: {
          dateTaken: {
            from: '2024-01-01',
            to: '2024-12-31',
          },
        },
      };

      assert.ok(request.filter?.dateTaken);
      assert.strictEqual(request.filter.dateTaken.from, '2024-01-01');
    });

    it('should support filter with mime types', () => {
      const request: PhotoListRequest = {
        filter: {
          mimeType: ['image/jpeg', 'image/png'],
        },
      };

      assert.ok(request.filter?.mimeType);
      assert.strictEqual(request.filter.mimeType.length, 2);
    });

    it('should support sparse fields', () => {
      const request: PhotoListRequest = {
        fields: ['id', 'url', 'fileName', 'dateTaken'],
      };

      assert.ok(request.fields);
      assert.strictEqual(request.fields.length, 4);
    });
  });

  describe('BatchOperationRequest Type', () => {
    it('should support tag operation', () => {
      const request: BatchOperationRequest = {
        operation: 'tag',
        photoIds: ['photo_001', 'photo_002'],
        parameters: { tag: 'vacation' },
      };

      assert.strictEqual(request.operation, 'tag');
      assert.strictEqual(request.photoIds.length, 2);
    });

    it('should support all operation types', () => {
      const operations: Array<'tag' | 'remove_tag' | 'move_to_album' | 'archive' | 'delete'> = [
        'tag',
        'remove_tag',
        'move_to_album',
        'archive',
        'delete',
      ];

      assert.strictEqual(operations.length, 5);
    });

    it('should support operation ID for idempotence', () => {
      const request: BatchOperationRequest = {
        operationId: 'batch_op_123',
        operation: 'tag',
        photoIds: ['photo_001'],
        parameters: { tag: 'test' },
      };

      assert.ok(request.operationId);
    });
  });

  describe('AuditEvent Type', () => {
    it('should have required audit event properties', () => {
      const event: AuditEvent = {
        timestamp: new Date(),
        sessionId: 'sess_test_001',
        userId: 'test@example.com',
        provider: 'google',
        eventType: 'auth:login',
        success: true,
        details: { scope: 'photos.readonly' },
        requestId: 'req_123',
      };

      assert.ok(event.timestamp instanceof Date);
      assert.strictEqual(event.eventType, 'auth:login');
      assert.strictEqual(event.success, true);
    });

    it('should support failure details', () => {
      const event: AuditEvent = {
        timestamp: new Date(),
        sessionId: 'sess_test_001',
        userId: 'test@example.com',
        provider: 'google',
        eventType: 'auth:login_failed',
        success: false,
        errorReason: '401 Unauthorized',
        details: { attempts: 3 },
        requestId: 'req_456',
      };

      assert.strictEqual(event.success, false);
      assert.ok(event.errorReason);
    });
  });

  describe('RateLimitInfo Type', () => {
    it('should track quota usage', () => {
      const info: RateLimitInfo = {
        limit: 100,
        remaining: 75,
        reset: new Date(Date.now() + 3600000),
        percentUsed: 25,
      };

      assert.strictEqual(info.percentUsed, 25);
      assert.strictEqual(info.remaining, 75);
    });
  });
});
