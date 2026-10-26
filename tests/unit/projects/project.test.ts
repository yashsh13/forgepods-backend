
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { AuthRequest } from "../../../src/middleware/auth.middleware.js";

const {
  mockCreate,
  mockFindMany,
  mockFindFirst,
  mockDeleteMany,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("../../../src/config/database/prismaClient.js", () => ({
  default: {
    project: {
      create: mockCreate,
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      deleteMany: mockDeleteMany,
    },
  },
}));

import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
} from "../../../src/controllers/project.controller.js";

function createMocks(body: unknown = {}, userId = "user-1", id = "project-1") {
  const req = {
    body,
    userId,
    params: { id },
  } as unknown as AuthRequest;

  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return {
    req,
    res: res as unknown as Response & {
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
    },
  };
}

describe("Project controller unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project for the authenticated user", async () => {
    mockCreate.mockResolvedValue({
      id: "project-1",
      name: "My App",
      description: null,
      template: "NODEJS",
      status: "CREATED",
    });

    const { req, res } = createMocks({
      name: "My App",
      template: "NODEJS",
    });

    await createProject(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "My App",
          userId: "user-1",
          template: "NODEJS",
        },
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects an empty project name", async () => {
    const { req, res } = createMocks({ name: "   " });

    await createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an unsupported template", async () => {
    const { req, res } = createMocks({
      name: "My App",
      template: "INVALID",
    });

    await createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("lists only the authenticated user's projects", async () => {
    mockFindMany.mockResolvedValue([]);

    const { req, res } = createMocks();

    await getProjects(req, res);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns a project belonging to the authenticated user", async () => {
    mockFindFirst.mockResolvedValue({
      id: "project-1",
      name: "My App",
      workspace: null,
    });

    const { req, res } = createMocks({}, "user-1", "project-1");

    await getProjectById(req, res);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "project-1",
          userId: "user-1",
        },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when the project is not owned by the user", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { req, res } = createMocks({}, "user-1", "other-project");

    await getProjectById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes only a project belonging to the authenticated user", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const { req, res } = createMocks({}, "user-1", "project-1");

    await deleteProject(req, res);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "project-1",
        userId: "user-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when there is no owned project to delete", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const { req, res } = createMocks({}, "user-1", "other-project");

    await deleteProject(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
