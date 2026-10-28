import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  createWorkspace,
  getWorkspace,
  deleteWorkspace,
} from "../services/workspace.service.js";
import { openWorkspacePortForward } from "../services/local-port-forward.service.js";
import prismaClient from "../config/database/prismaClient.js";

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
  } catch (error) {
    console.log(error);
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
  } catch (error){
    console.error("Failed to retrieve workspace:", error);

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


export async function openWorkspace(req: AuthRequest, res: Response) {
  try {
    const projectId = req.params.id;
    const userId = req.userId;

    if (typeof projectId !== "string" || !userId) {
      return res.status(400).json({
        message: "Invalid project ID or missing authentication",
      });
    }

    const project = await prismaClient.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const workspace = await prismaClient.workspace.findUnique({
      where: {
        projectId,
      },
    });

    if (
      !workspace ||
      workspace.status !== "RUNNING" ||
      !workspace.podName
    ) {
      return res.status(409).json({
        message: "Workspace is not running or has no service name.",
      });
    }

    const workspaceUrl = await openWorkspacePortForward(
      project.id,
      workspace.podName,
    );

    return res.status(200).json({
      message: "Workspace ready",
      url: workspaceUrl,
    });
  } catch (error) {
    console.error("Failed to open workspace:", error);

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to open workspace",
    });
  }
}
