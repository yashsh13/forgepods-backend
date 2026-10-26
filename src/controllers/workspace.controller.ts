import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  createWorkspace,
  getWorkspace,
  deleteWorkspace,
} from "../services/workspace.service.js";

function getProjectId(req: AuthRequest): string | undefined {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function startWorkspace(
  req: AuthRequest,
  res: Response,
) {
  const projectId = getProjectId(req);

  if (!projectId || !req.userId) {
    return res.status(400).json({
      message: "Project ID is required",
    });
  }

  try {
    const workspace = await createWorkspace(
      projectId,
      req.userId,
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    return res.status(202).json({
      message: "Workspace provisioning requested",
      workspace,
    });
  } catch {
    return res.status(500).json({
      message: "Failed to start workspace",
    });
  }
}

export async function workspaceStatus(
  req: AuthRequest,
  res: Response,
) {
  const projectId = getProjectId(req);

  if (!projectId || !req.userId) {
    return res.status(400).json({
      message: "Project ID is required",
    });
  }

  try {
    const workspace = await getWorkspace(
      projectId,
      req.userId,
    );

    if (!workspace) {
      return res.status(404).json({
        message: "Project or workspace not found",
      });
    }

    return res.status(200).json({ workspace });
  } catch {
    return res.status(500).json({
      message: "Failed to retrieve workspace",
    });
  }
}

export async function stopWorkspace(
  req: AuthRequest,
  res: Response,
) {
  const projectId = getProjectId(req);

  if (!projectId || !req.userId) {
    return res.status(400).json({
      message: "Project ID is required",
    });
  }

  try {
    const result = await deleteWorkspace(
      projectId,
      req.userId,
    );

    if (!result) {
      return res.status(404).json({
        message: "Project or workspace not found",
      });
    }

    return res.status(200).json({
      message: "Workspace deleted",
      ...result,
    });
  } catch {
    return res.status(500).json({
      message: "Failed to delete workspace",
    });
  }
}
