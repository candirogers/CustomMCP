/**
 * Unit Tests: Logger Utility
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { logger, LogLevel } from '../../src/utils/logger.js';

describe('Logger', () => {
  let originalConsole: any;

  beforeEach(() => {
    // Capture console output
    originalConsole = {
      log: console.log,
      debug: console.debug,
      warn: console.warn,
      error: console.error,
    };
  });

  afterEach(() => {
    // Restore console
    Object.assign(console, originalConsole);
  });

  describe('Log Levels', () => {
    it('should set and respect log level', () => {
      logger.setLevel(LogLevel.ERROR);

      let debugCalled = false;
      let infoCalled = false;
      let warnCalled = false;
      let errorCalled = false;

      console.debug = () => { debugCalled = true; };
      console.log = () => { infoCalled = true; };
      console.warn = () => { warnCalled = true; };
      console.error = () => { errorCalled = true; };

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      assert.strictEqual(debugCalled, false, 'DEBUG should not log at ERROR level');
      assert.strictEqual(infoCalled, false, 'INFO should not log at ERROR level');
      assert.strictEqual(warnCalled, false, 'WARN should not log at ERROR level');
      assert.strictEqual(errorCalled, true, 'ERROR should log at ERROR level');

      logger.setLevel('debug'); // Reset for other tests
    });

    it('should accept level by string name', () => {
      logger.setLevel('warn');
      // If it doesn't throw, it worked
      assert.ok(true);

      logger.setLevel('debug'); // Reset
    });
  });

  describe('Message Formatting', () => {
    it('should include timestamp in output', (_, done) => {
      logger.setLevel(LogLevel.INFO);
      let output = '';
      console.log = (msg: string) => { output = msg; };

      logger.info('Test message');

      assert.ok(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(output), 'Should include ISO timestamp');
      done();
    });

    it('should include log level in output', (_, done) => {
      logger.setLevel(LogLevel.INFO);
      let output = '';
      console.log = (msg: string) => { output = msg; };

      logger.info('Test message');

      assert.ok(output.includes('[INFO]'), 'Should include log level');
      done();
    });

    it('should include message text', (_, done) => {
      logger.setLevel(LogLevel.INFO);
      let output = '';
      console.log = (msg: string) => { output = msg; };

      logger.info('Test message');

      assert.ok(output.includes('Test message'), 'Should include message text');
      done();
    });

    it('should include context as JSON when provided', (_, done) => {
      logger.setLevel(LogLevel.INFO);
      let output = '';
      console.log = (msg: string) => { output = msg; };

      logger.info('Test message', { key: 'value', count: 42 });

      assert.ok(output.includes('key'), 'Should include context key');
      assert.ok(output.includes('value'), 'Should include context value');
      done();
    });
  });

  describe('Error Logging', () => {
    it('should handle Error instances', (_, done) => {
      logger.setLevel(LogLevel.ERROR);
      let output = '';
      console.error = (msg: string, ctx: any) => { output = msg + JSON.stringify(ctx); };

      const error = new Error('Test error');
      logger.error('Error occurred', error);

      assert.ok(output.includes('Error occurred'), 'Should include message');
      assert.ok(output.includes('Test error'), 'Should include error message');
      done();
    });

    it('should extract stack trace from Error', (_, done) => {
      logger.setLevel(LogLevel.ERROR);
      let output = '';
      console.error = (msg: string, ctx: any) => { output = msg + JSON.stringify(ctx); };

      const error = new Error('Stack trace test');
      logger.error('Error occurred', error);

      assert.ok(output.includes('stack'), 'Should include stack property');
      done();
    });

    it('should handle object context', (_, done) => {
      logger.setLevel(LogLevel.ERROR);
      let output = '';
      console.error = (msg: string, ctx: any) => { output = msg + JSON.stringify(ctx); };

      logger.error('Error occurred', { code: 'E_TEST', detail: 'Test detail' });

      assert.ok(output.includes('code'), 'Should include context property');
      done();
    });
  });

  describe('All Log Levels', () => {
    it('should log debug messages', (_, done) => {
      logger.setLevel(LogLevel.DEBUG);
      let called = false;
      console.debug = () => { called = true; };

      logger.debug('Debug message');

      assert.strictEqual(called, true);
      done();
    });

    it('should log info messages', (_, done) => {
      logger.setLevel(LogLevel.INFO);
      let called = false;
      console.log = () => { called = true; };

      logger.info('Info message');

      assert.strictEqual(called, true);
      done();
    });

    it('should log warn messages', (_, done) => {
      logger.setLevel(LogLevel.WARN);
      let called = false;
      console.warn = () => { called = true; };

      logger.warn('Warn message');

      assert.strictEqual(called, true);
      done();
    });

    it('should log error messages', (_, done) => {
      logger.setLevel(LogLevel.ERROR);
      let called = false;
      console.error = () => { called = true; };

      logger.error('Error message');

      assert.strictEqual(called, true);
      done();
    });
  });
});
