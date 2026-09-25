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

function mutate(method: 'post' | 'patch', url: string, auth: Awaited<ReturnType<typeof login>>, body: object) {
  return request(app)[method](url).set('Cookie', auth.cookie).set('x-csrf-token', auth.csrfToken).send(body);
}

async function approvedRequest(studentId: string, itemId: string, approvedQty = 2) {
  return prisma.request.create({
    data: {
      requesterId: studentId,
      purpose: 'Build a line-following robot',
      decisionStatus: 'APPROVED',
      lines: { create: { itemId, requestedQty: approvedQty, approvedQty } },
    },
    include: { lines: true },
  });
}

describe('request, issue and return invariants', () => {
  it('rejects non-positive request quantities and project requests by non-members', async () => {
    const student = await createUser();
    const auth = await login(student.collegeId);
    const { item } = await createInventory();
    const invalidQuantity = await mutate('post', '/api/v1/requests', auth, {
      targetType: 'PERSONAL', purpose: 'Robot build', lines: [{ itemId: item.id, quantity: 0 }],
    });
    expect(invalidQuantity.status).toBe(400);

    const project = await prisma.project.create({ data: { name: 'Restricted Project' } });
    const unauthorizedProject = await mutate('post', '/api/v1/requests', auth, {
      targetType: 'PROJECT', projectId: project.id, purpose: 'Robot build', lines: [{ itemId: item.id, quantity: 1 }],
    });
    expect(unauthorizedProject.status).toBe(403);
  });

  it('rejects decisions that approve more than requested or reference another request line', async () => {
    const admin = await createUser('ADMIN');
    const student = await createUser('STUDENT');
    const auth = await login(admin.collegeId);
    const first = await createInventory();
    const second = await createInventory();
    const requestOne = await prisma.request.create({ data: { requesterId: student.id, purpose: 'A', lines: { create: { itemId: first.item.id, requestedQty: 1 } } }, include: { lines: true } });
    const requestTwo = await prisma.request.create({ data: { requesterId: student.id, purpose: 'B', lines: { create: { itemId: second.item.id, requestedQty: 1 } } }, include: { lines: true } });

    const tooMuch = await mutate('post', `/api/v1/requests/${requestOne.id}/decision`, auth, { status: 'APPROVED', lines: [{ lineId: requestOne.lines[0]!.id, approvedQuantity: 2 }] });
    expect(tooMuch.status).toBe(400);
    const foreign = await mutate('post', `/api/v1/requests/${requestOne.id}/decision`, auth, { status: 'APPROVED', lines: [{ lineId: requestTwo.lines[0]!.id, approvedQuantity: 1 }] });
    expect(foreign.status).toBe(400);
  });

  it('issues only approved outstanding quantity and prevents duplicate command replay', async () => {
    const admin = await createUser('ADMIN');
    const student = await createUser('STUDENT');
    const auth = await login(admin.collegeId);
    const { item } = await createInventory({ quantity: 5 });
    const equipmentRequest = await approvedRequest(student.id, item.id, 2);
    const command = {
      requestId: equipmentRequest.id,
      collectorCollegeId: student.collegeId,
      clientCommandId: 'issue-command-001',
      lines: [{ requestLineId: equipmentRequest.lines[0]!.id, quantity: 2 }],
    };
    const first = await mutate('post', '/api/v1/issues', auth, command);
    expect(first.status).toBe(201);
    const replay = await mutate('post', '/api/v1/issues', auth, command);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);

    const overIssue = await mutate('post', '/api/v1/issues', auth, { ...command, clientCommandId: 'issue-command-002', lines: [{ requestLineId: equipmentRequest.lines[0]!.id, quantity: 1 }] });
    expect(overIssue.status).toBe(409);
    const balance = await prisma.stockBalance.findFirstOrThrow({ where: { itemId: item.id } });
    expect(balance.availableQuantity).toBe(3);
  });

  it('cannot return a serialized unit that was not part of the issue', async () => {
    const admin = await createUser('ADMIN');
    const student = await createUser('STUDENT');
    const auth = await login(admin.collegeId);
    const { item } = await createInventory({ trackingMode: 'SERIALIZED', quantity: 2 });
    const equipmentRequest = await approvedRequest(student.id, item.id, 1);
    const units = await prisma.inventoryUnit.findMany({ where: { itemId: item.id }, orderBy: { assetCode: 'asc' } });
    const issued = await mutate('post', '/api/v1/issues', auth, {
      requestId: equipmentRequest.id, collectorCollegeId: student.collegeId, clientCommandId: 'serialized-issue', lines: [{ requestLineId: equipmentRequest.lines[0]!.id, quantity: 1, unitIds: [units[0]!.id] }],
    });
    expect(issued.status).toBe(201);
    const issueLine = await prisma.issueLine.findFirstOrThrow({ where: { issueId: issued.body.id } });
    const invalidReturn = await mutate('post', '/api/v1/returns', auth, {
      issueId: issued.body.id, clientCommandId: 'invalid-return', lines: [{ issueLineId: issueLine.id, quantity: 1, unitId: units[1]!.id, condition: 'WORKING' }],
    });
    expect(invalidReturn.status).toBe(400);
  });
});
