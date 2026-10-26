
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { mockCreate, mockFindUnique } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("../../../src/config/database/prismaClient.js", () => ({
  default: {
    user: {
      create: mockCreate,
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("../../../src/config/env.js", () => ({
  default: {
    JWT_SECRET: "unit-test-secret-that-is-at-least-32-characters",
    PORT: 3000,
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://unused",
  },
}));

import { register, login } from "../../../src/controllers/auth.controller.js";

function mockResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function mockRequest(body: unknown) {
  return { body } as Request;
}

describe("Authentication controller unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid registration input", async () => {
    const res = mockResponse();

    await register(mockRequest({
      email: "not-an-email",
      password: "123",
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a user with a hashed password", async () => {
    mockCreate.mockImplementation(async ({ data }) => ({
      id: "user-1",
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    }));

    const res = mockResponse();

    await register(mockRequest({
      name: "Test User",
      email: "TEST@example.com",
      password: "ForgePodsTest123",
    }), res);

    expect(mockCreate).toHaveBeenCalledOnce();

    const args = mockCreate.mock.calls[0]![0];
    expect(args.data.email).toBe("test@example.com");
    expect(args.data.passwordHash).not.toBe("ForgePodsTest123");

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects login when the user does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = mockResponse();

    await login(mockRequest({
      email: "missing@example.com",
      password: "ForgePodsTest123",
    }), res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
