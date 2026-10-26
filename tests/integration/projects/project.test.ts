
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../src/app.js";
import prisma from "../../../src/config/database/prismaClient.js";
import parsedEnv from "../../../src/config/env.js";

const testUserIds = new Set<string>();

async function createTestUser() {
  const user = await prisma.user.create({
    data: {
      name: "ForgePods Integration Test",
      email: `forgepods-${randomUUID()}@example.com`,
      passwordHash: "integration-test-hash",
    },
  });

  testUserIds.add(user.id);
  return user;
}

function createToken(userId: string) {
  return jwt.sign(
    { userId },
    parsedEnv.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

async function createTestProject(userId: string, name = "Test Project") {
  return prisma.project.create({
    data: {
      name,
      userId,
    },
  });
}

describe("Projects API integration tests", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    const userIds = [...testUserIds];

    if (userIds.length > 0) {
      // Delete only projects owned by users created by this test suite.
      await prisma.project.deleteMany({
        where: { userId: { in: userIds } },
      });

      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });

      testUserIds.clear();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects requests without an authentication token", async () => {
    const response = await request(app).get("/api/projects");

    expect(response.status).toBe(401);
  });

  it("creates a project with the default NODEJS template", async () => {
    const user = await createTestUser();
    const token = createToken(user.id);

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "My Node App" });

    expect(response.status).toBe(201);
    expect(response.body.project.name).toBe("My Node App");
    expect(response.body.project.template).toBe("NODEJS");
    expect(response.body.project.status).toBe("CREATED");
  });

  it("rejects invalid project input", async () => {
    const user = await createTestUser();
    const token = createToken(user.id);

    const response = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
  });

  it("lists only projects owned by the authenticated user", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    await createTestProject(userA.id, "User A Project");
    await createTestProject(userB.id, "User B Project");

    const response = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${createToken(userA.id)}`);

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(1);
    expect(response.body.projects[0].name).toBe("User A Project");
    expect(
      response.body.projects.every(
        (project: { name: string }) => project.name !== "User B Project"
      )
    ).toBe(true);
  });

  it("fetches a project owned by the authenticated user", async () => {
    const user = await createTestUser();
    const project = await createTestProject(user.id, "My Project");

    const response = await request(app)
      .get(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${createToken(user.id)}`);

    expect(response.status).toBe(200);
    expect(response.body.project.id).toBe(project.id);
    expect(response.body.project.name).toBe("My Project");
  });

  it("returns 404 when fetching another user's project", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const projectB = await createTestProject(userB.id, "Private Project");

    const response = await request(app)
      .get(`/api/projects/${projectB.id}`)
      .set("Authorization", `Bearer ${createToken(userA.id)}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent project", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .get("/api/projects/nonexistent-project-id")
      .set("Authorization", `Bearer ${createToken(user.id)}`);

    expect(response.status).toBe(404);
  });

  it("deletes a project owned by the authenticated user", async () => {
    const user = await createTestUser();
    const project = await createTestProject(user.id, "Project to Delete");

    const response = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${createToken(user.id)}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Project deleted successfully");

    const savedProject = await prisma.project.findUnique({
      where: { id: project.id },
    });

    expect(savedProject).toBeNull();
  });

  it("cannot delete another user's project", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const projectB = await createTestProject(userB.id, "Protected Project");

    const response = await request(app)
      .delete(`/api/projects/${projectB.id}`)
      .set("Authorization", `Bearer ${createToken(userA.id)}`);

    expect(response.status).toBe(404);

    const savedProject = await prisma.project.findUnique({
      where: { id: projectB.id },
    });

    expect(savedProject).not.toBeNull();
    expect(savedProject!.userId).toBe(userB.id);
  });
});
