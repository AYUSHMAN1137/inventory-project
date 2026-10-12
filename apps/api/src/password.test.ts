import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';
import { createUser } from './test/factories.js';

function cookieValue(response: request.Response, name: string) {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header) ? header : [header];
  return values.find((value) => value?.startsWith(`${name}=`));
}

async function signIn(collegeId: string, password = 'Password@123') {
  const login = await request(app).post('/api/v1/auth/login').send({ collegeId, password });
  return {
    cookie: cookieValue(login, 'dt_session')!,
    csrfToken: login.body.csrfToken as string,
  };
}

const VALID_NEW = 'Str0ng#Pass2026';

describe('password change', () => {
  it('changes the password, clears mustChangePassword and revokes other sessions', async () => {
    const user = await createUser();
    // Simulate an admin-provisioned account still on the temporary password.
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });

    const first = await signIn(user.collegeId);
    const second = await signIn(user.collegeId);

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', second.cookie)
      .set('x-csrf-token', second.csrfToken)
      .send({ currentPassword: 'Password@123', newPassword: VALID_NEW, confirmPassword: VALID_NEW });

    expect(response.status).toBe(200);
    expect(response.body.user.mustChangePassword).toBe(false);
    expect(response.body.user.passwordHash).toBeUndefined();
    // The rotating session stays valid so the user need not sign in again.
    expect(cookieValue(response, 'dt_session')).toBeDefined();

    // Every other session died with the old password.
    const stale = await request(app).get('/api/v1/auth/me').set('Cookie', first.cookie);
    expect(stale.status).toBe(401);

    const fresh = await request(app).get('/api/v1/auth/me').set('Cookie', cookieValue(response, 'dt_session')!);
    expect(fresh.status).toBe(200);

    // The new password actually works end to end.
    const relogin = await request(app).post('/api/v1/auth/login').send({ collegeId: user.collegeId, password: VALID_NEW });
    expect(relogin.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const user = await createUser();
    const session = await signIn(user.collegeId);

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .send({ currentPassword: 'not-my-password', newPassword: VALID_NEW, confirmPassword: VALID_NEW });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('rejects a password that breaks the policy', async () => {
    const user = await createUser();
    const session = await signIn(user.collegeId);

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .send({ currentPassword: 'Password@123', newPassword: 'short', confirmPassword: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a confirmation that does not match', async () => {
    const user = await createUser();
    const session = await signIn(user.collegeId);

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .send({ currentPassword: 'Password@123', newPassword: VALID_NEW, confirmPassword: 'Different#1x' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('PASSWORD_MISMATCH');
  });

  it('rejects reusing the current password as the new one', async () => {
    const user = await createUser();
    const session = await signIn(user.collegeId);

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .send({ currentPassword: 'Password@123', newPassword: 'Password@123', confirmPassword: 'Password@123' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('PASSWORD_REUSED');
  });

  it('requires a valid CSRF token', async () => {
    const user = await createUser();
    const session = await signIn(user.collegeId);

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', session.cookie)
      .send({ currentPassword: 'Password@123', newPassword: VALID_NEW, confirmPassword: VALID_NEW });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  it('blocks mutations while the temporary password is still in place, but allows the change itself', async () => {
    const user = await createUser('ADMIN');
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    const session = await signIn(user.collegeId);

    const blocked = await request(app)
      .post('/api/v1/categories')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .send({ name: 'Blocked Category' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const change = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .send({ currentPassword: 'Password@123', newPassword: VALID_NEW, confirmPassword: VALID_NEW });
    expect(change.status).toBe(200);

    const allowed = await request(app)
      .post('/api/v1/categories')
      .set('Cookie', cookieValue(change, 'dt_session')!)
      .set('x-csrf-token', change.body.csrfToken)
      .send({ name: 'Allowed Category' });
    expect(allowed.status).toBe(201);
  });

  it('refuses to change a password without a session', async () => {
    const response = await request(app)
      .patch('/api/v1/auth/password')
      .send({ currentPassword: 'Password@123', newPassword: VALID_NEW, confirmPassword: VALID_NEW });

    expect(response.status).toBe(401);
  });
});
