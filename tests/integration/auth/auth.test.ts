import jwt from "jsonwebtoken";
import parsedEnv from "../../../src/config/env.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../../../src/app.js";
import prisma from "../../../src/config/database/prismaClient.js";

const testEmails = new Set<string>();

function createTestEmail() {
  const email = `forgepods-${randomUUID()}@example.com`;
  testEmails.add(email);
  return email;
}

async function createTestUser(email: string, password: string) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 4),
      name: "Integration Test User",
    },
  });
}

describe("Authentication API integration tests", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (testEmails.size > 0) {
      await prisma.user.deleteMany({
        where: {
          email: { in: [...testEmails] },
        },
      });

      testEmails.clear();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers a user without exposing the password hash", async () => {
    const email = createTestEmail();

    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email, password: "ForgePodsTest123" });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const saved = await prisma.user.findUnique({ where: { email } });
    expect(saved).not.toBeNull();
    expect(saved!.passwordHash).not.toBe("ForgePodsTest123");
    expect(await bcrypt.compare("ForgePodsTest123", saved!.passwordHash)).toBe(true);
  });

  it("rejects duplicate email registration", async () => {
    const email = createTestEmail();
    await createTestUser(email, "ForgePodsTest123");

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "ForgePodsTest123" });

    expect(response.status).toBe(409);
  });

  it("rejects invalid registration input", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "invalid-email", password: "123" });

    expect(response.status).toBe(400);
  });

  it("logs in with valid credentials", async () => {
    const email = createTestEmail();
    await createTestUser(email, "ForgePodsTest123");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "ForgePodsTest123" });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an incorrect password", async () => {
    const email = createTestEmail();
    await createTestUser(email, "ForgePodsTest123");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPassword123" });

    expect(response.status).toBe(401);
    expect(response.body).not.toHaveProperty("token");
  });

  it("rejects login for an unknown user", async () => {
    const email = createTestEmail();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "ForgePodsTest123" });

    expect(response.status).toBe(401);
  });

  it("rejects access to /me without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "Authentication token is required"
    );
  });

  it("rejects access to /me with an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expiredToken = jwt.sign(
      { userId: "user-123" },
      parsedEnv.JWT_SECRET,
      { expiresIn: -1 }
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it("returns the userId for a valid token", async () => {
    const token = jwt.sign(
      { userId: "user-123" },
      parsedEnv.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: "user-123" });
  });

});

