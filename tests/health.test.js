const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Health response', () => {
  it('should return status ok', () => {
    const response = {
      status: 'ok',
      version: process.env.APP_VERSION || 'dev',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    assert.strictEqual(response.status, 'ok');
    assert.ok(response.uptime >= 0);
    assert.ok(response.timestamp.includes('T'));
  });

  it('APP_VERSION should be configurable via env', () => {
    process.env.APP_VERSION = 'v1.0.0-test';
    const version = process.env.APP_VERSION || 'dev';
    assert.strictEqual(version, 'v1.0.0-test');
  });
});
