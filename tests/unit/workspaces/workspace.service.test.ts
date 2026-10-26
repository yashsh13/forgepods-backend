import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createNamespacedPod: vi.fn(),
  createNamespacedService: vi.fn(),
  deleteNamespacedPod: vi.fn(),
  deleteNamespacedService: vi.fn(),
}));

vi.mock("../../../src/config/database/prismaClient.js", () => ({
  default: {
    project: {
      findFirst: mocks.findFirst,
    },
    workspace: {
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

vi.mock(
  "../../../src/infrastructure/kubernetes/kubernetes.client.js",
  () => ({
    getKubernetesClient: () => ({
      createNamespacedPod: mocks.createNamespacedPod,
      createNamespacedService: mocks.createNamespacedService,
      deleteNamespacedPod: mocks.deleteNamespacedPod,
      deleteNamespacedService: mocks.deleteNamespacedService
    }),
  }),
);

import { createWorkspace } from "../../../src/services/workspace.service.js";

describe("createWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNamespacedPod.mockResolvedValue({});
    mocks.createNamespacedService.mockResolvedValue({});
  });

  it("does not provision a workspace for a project the user does not own", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await createWorkspace("project-1", "user-1");

    expect(result).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.createNamespacedPod).not.toHaveBeenCalled();
  });

  it("creates a workspace and requests a Kubernetes Pod", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "project-1",
      workspace: null,
    });

    mocks.create.mockResolvedValue({
      id: "workspace-1",
      projectId: "project-1",
      status: "PENDING",
    });

    mocks.update.mockResolvedValue({
      id: "workspace-1",
      status: "CREATING",
    });

    const result = await createWorkspace("project-1", "user-1");

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          status: "PENDING",
        }),
      }),
    );

    expect(mocks.createNamespacedPod).toHaveBeenCalledOnce();
    expect(mocks.createNamespacedService).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ status: "CREATING" });
  });

  it("returns the existing workspace without creating another Pod", async () => {
    const existingWorkspace = {
      id: "workspace-1",
      status: "RUNNING",
    };

    mocks.findFirst.mockResolvedValue({
      id: "project-1",
      workspace: existingWorkspace,
    });

    const result = await createWorkspace("project-1", "user-1");

    expect(result).toEqual(existingWorkspace);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.createNamespacedPod).not.toHaveBeenCalled();
  });

  it("marks the workspace as failed when Kubernetes creation fails", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "project-1",
      workspace: null,
    });

    mocks.create.mockResolvedValue({
      id: "workspace-1",
      status: "PENDING",
    });

    mocks.createNamespacedPod.mockRejectedValue(
      new Error("Cluster unavailable"),
    );

    mocks.update.mockResolvedValue({
      id: "workspace-1",
      status: "FAILED",
    });

    await expect(
      createWorkspace("project-1", "user-1"),
    ).rejects.toThrow("Failed to create workspace");

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "workspace-1" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "Cluster unavailable",
        }),
      }),
    );
  });
});
