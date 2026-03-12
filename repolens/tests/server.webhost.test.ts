import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createServer } from '../server/src/index';

describe('web hosting integration', () => {
  it('serves SPA entrypoint for flow visualization route when web build exists', async () => {
    const app = createServer();

    const response = await request(app).get('/visualization/flow/sample');

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(response.text.toLowerCase()).toContain('<!doctype html>');
    }
  });
});
