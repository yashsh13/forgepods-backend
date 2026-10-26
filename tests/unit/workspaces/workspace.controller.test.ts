
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
}));

vi.mock("../../../src/services/workspace.service.js", () => ({
  createWorkspace: mocks.createWorkspace,
  getWorkspace: mocks.getWorkspace,
  deleteWorkspace: mocks.deleteWorkspace,
}));

vi.mock("../../../src/middleware/auth.middleware.js", () => ({
  default: (
    req: express.Request & { userId?: string },
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.userId = "user-1";
    next();
  },
}));

import projectRouter from "../../../src/routes/project.routes.js";

const app = express();
app.use(express.json());
app.use("/api/projects", projectRouter);

describe("Workspace endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 202 when workspace provisioning is requested", async () => {
    mocks.createWorkspace.mockResolvedValue({
      id: "workspace-1",
      status: "CREATING",
    });

    const response = await request(app)
      .post("/api/projects/project-1/workspace");

    expect(response.status).toBe(202);
    expect(response.body.workspace.status).toBe("CREATING");
    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      "project-1",
      "user-1",
    );
  });

  it("returns 404 when the project does not exist or is not owned", async () => {
    mocks.createWorkspace.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/projects/unknown/workspace");

    expect(response.status).toBe(404);
  });

  it("returns workspace status", async () => {
    mocks.getWorkspace.mockResolvedValue({
      id: "workspace-1",
      status: "RUNNING",
    });

    const response = await request(app)
      .get("/api/projects/project-1/workspace");

    expect(response.status).toBe(200);
    expect(response.body.workspace.status).toBe("RUNNING");
  });

  it("returns 404 when no workspace exists", async () => {
    mocks.getWorkspace.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/projects/project-1/workspace");

    expect(response.status).toBe(404);
  });

  it("deletes the workspace", async () => {
    mocks.deleteWorkspace.mockResolvedValue({
      deleted: true,
      projectId: "project-1",
    });

    const response = await request(app)
      .delete("/api/projects/project-1/workspace");

    expect(response.status).toBe(200);
    expect(mocks.deleteWorkspace).toHaveBeenCalledWith(
      "project-1",
      "user-1",
    );
  });

  it("returns 500 when workspace creation fails", async () => {
    mocks.createWorkspace.mockRejectedValue(
      new Error("Cluster unavailable"),
    );

    const response = await request(app)
      .post("/api/projects/project-1/workspace");

    expect(response.status).toBe(500);
  });
});
