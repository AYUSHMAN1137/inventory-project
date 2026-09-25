import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app.js';
import { createUser } from './test/factories.js';

function cookieValue(response: request.Response, name: string) {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header) ? header : [header];
  return values.find((value) => value?.startsWith(`${name}=`));
}

describe('authentication', () => {
  it('creates an opaque server session and never exposes the user id as the cookie value', async () => {
    const user = await createUser();
    const response = await request(app).post('/api/v1/auth/login').send({ collegeId: user.collegeId, password: 'Password@123' });

    expect(response.status).toBe(200);
    const sessionCookie = cookieValue(response, 'dt_session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).not.toContain(user.id);
    expect(String(response.headers['set-cookie'])).not.toContain('dt_user_id');
  });

  it('rejects a forged legacy user-id cookie', async () => {
    const user = await createUser();
    const response = await request(app).get('/api/v1/auth/me').set('Cookie', `dt_user_id=${user.id}`);
    expect(response.status).toBe(401);
  });

  it('returns a CSRF token and requires it for authenticated mutations', async () => {
    const user = await createUser('ADMIN');
    const login = await request(app).post('/api/v1/auth/login').send({ collegeId: user.collegeId, password: 'Password@123' });
    const cookie = cookieValue(login, 'dt_session')!;

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.csrfToken).toEqual(expect.any(String));

    const forbidden = await request(app).post('/api/v1/categories').set('Cookie', cookie).send({ name: 'Sensors' });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post('/api/v1/categories')
      .set('Cookie', cookie)
      .set('x-csrf-token', me.body.csrfToken)
      .send({ name: 'Sensors' });
    expect(allowed.status).toBe(201);
  });
});
