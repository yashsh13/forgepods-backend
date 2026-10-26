import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mockVerify,
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

import authenticateToken, {
  type AuthRequest,
} from "../../../src/middleware/auth.middleware.js";

function createMocks(authorization?: string) {
  const req = {
    headers: authorization ? { authorization } : {},
  } as AuthRequest;

  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  const next = vi.fn() as unknown as NextFunction;

  return {
    req,
    res: res as unknown as Response & {
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
    },
    next,
  };
}

describe("Authentication middleware unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request without an authorization header", () => {
    const { req, res, next } = createMocks();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication token is required",
    });
    expect(next).not.toHaveBeenCalled();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("rejects an authorization header without the Bearer prefix", () => {
    const { req, res, next } = createMocks("some-token");

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", () => {
    mockVerify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const { req, res, next } = createMocks("Bearer invalid-token");

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired authentication token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a token without a valid userId", () => {
    mockVerify.mockReturnValue({ email: "test@example.com" });

    const { req, res, next } = createMocks("Bearer token");

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid authentication token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the userId and calls next for a valid token", () => {
    mockVerify.mockReturnValue({ userId: "user-123" });

    const { req, res, next } = createMocks("Bearer valid-token");

    authenticateToken(req, res, next);

    expect(mockVerify).toHaveBeenCalledWith(
      "valid-token",
      "unit-test-secret-that-is-at-least-32-characters"
    );
    expect(req.userId).toBe("user-123");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
