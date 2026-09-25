import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';
import { createInventory, createUser } from './test/factories.js';

async function login(collegeId: string) {
  const response = await request(app).post('/api/v1/auth/login').send({ collegeId, password: 'Password@123' });
  const cookies = response.headers['set-cookie'];
  const cookie = (Array.isArray(cookies) ? cookies : [cookies]).find((value) => value?.startsWith('dt_session='))!;
  const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
  return { cookie, csrfToken: me.body.csrfToken as string };
}

function post(url: string, auth: Awaited<ReturnType<typeof login>>, body: object) {
  return request(app).post(url).set('Cookie', auth.cookie).set('x-csrf-token', auth.csrfToken).send(body);
}

describe('administration and request lifecycle', () => {
  it('allows only admins to create users', async () => {
    const admin = await createUser('ADMIN');
    const student = await createUser('STUDENT');
    const adminAuth = await login(admin.collegeId);
    const studentAuth = await login(student.collegeId);
    const body = { collegeId: '2025ECE001', name: 'New Student', role: 'STUDENT', temporaryPassword: 'SecurePass123!' };

    expect((await post('/api/v1/users', studentAuth, body)).status).toBe(403);
    const created = await post('/api/v1/users', adminAuth, body);
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty('passwordHash');
    expect(created.body.mustChangePassword).toBe(true);
  });

  it('creates a project with validated student members', async () => {
    const admin = await createUser('ADMIN');
    const student = await createUser('STUDENT');
    const auth = await login(admin.collegeId);
    const response = await post('/api/v1/projects', auth, { name: 'Rescue Rover', description: 'Autonomous response platform', memberIds: [student.id] });
    expect(response.status).toBe(201);
    expect(response.body.members[0].user.collegeId).toBe(student.collegeId);
  });

  it('allows a student to cancel only their pending unissued request', async () => {
    const student = await createUser('STUDENT');
    const other = await createUser('STUDENT', '2024BCSE099');
    const { item } = await createInventory();
    const pending = await prisma.request.create({ data: { requesterId: student.id, purpose: 'Prototype testing', lines: { create: { itemId: item.id, requestedQty: 1 } } } });
    const studentAuth = await login(student.collegeId);
    const otherAuth = await login(other.collegeId);

    expect((await post(`/api/v1/requests/${pending.id}/cancel`, otherAuth, {})).status).toBe(403);
    const cancelled = await post(`/api/v1/requests/${pending.id}/cancel`, studentAuth, {});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.decisionStatus).toBe('CANCELLED');
    expect((await post(`/api/v1/requests/${pending.id}/cancel`, studentAuth, {})).status).toBe(409);
  });
});
