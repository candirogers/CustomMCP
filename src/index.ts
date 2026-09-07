#!/usr/bin/env node

import { Server } from './mcp/server.js';
import { logger } from './utils/logger.js';

/**
 * MCP Cloud Photos Server
 *
 * A Model Context Protocol implementation for authenticated cloud photo access
 * with multi-session support, policy enforcement, and resilience patterns.
 */

const server = new Server({
  name: 'photos-mcp',
  version: '0.1.0',
  capabilities: {
    tools: true,
    resources: true,
    logging: true,
  },
});

// Initialize server components
server.on('ready', () => {
  logger.info('✅ Photos MCP server ready', {
    version: server.version,
    capabilities: server.capabilities,
  });
});

server.on('error', (error: Error) => {
  logger.error('❌ MCP server error:', error);
  process.exit(1);
});

server.on('tool:authenticate', async (request: any) => {
  return server.handleAuthenticate(request);
});

server.on('tool:list_photos', async (request: any) => {
  return server.handleListPhotos(request);
});

server.on('tool:search_photos', async (request: any) => {
  return server.handleSearchPhotos(request);
});

server.on('tool:get_photo_metadata', async (request: any) => {
  return server.handleGetPhotoMetadata(request);
});

server.on('tool:batch_get_metadata', async (request: any) => {
  return server.handleBatchGetMetadata(request);
});

server.on('tool:apply_batch_operation', async (request: any) => {
  return server.handleBatchOperation(request);
});

server.on('resource:photo_metadata', async (request: any) => {
  return server.handlePhotoMetadataResource(request);
});

server.on('resource:audit_logs', async (request: any) => {
  return server.handleAuditLogsResource(request);
});

// Start the server
server.start().catch((error: Error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP server...');
  await server.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Terminating MCP server...');
  await server.shutdown();
  process.exit(0);
});

export { server };
