
import type { Response } from "express";
import { z } from "zod";
import prismaClient from "../config/database/prismaClient.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  template: z
    .enum(["NODEJS", "PYTHON", "REACT", "NEXTJS"])
    .optional(),
});

export async function createProject(
  req: AuthRequest,
  res: Response
) {
  const parsed = createProjectSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid project data",
      errors: parsed.error.issues,
    });
  }

  try {
    const project = await prismaClient.project.create({
        data: {
        name: parsed.data.name,
        userId: req.userId!,
        ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
        ...(parsed.data.template !== undefined
            ? { template: parsed.data.template }
            : {}),
        },
      select: {
        id: true,
        name: true,
        description: true,
        template: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error: unknown) {
    console.error("Project creation failed:", error);

    return res.status(500).json({
      message: "Failed to create project",
    });
  }
}

export async function getProjects(
  req: AuthRequest,
  res: Response
) {
  try {
    const projects = await prismaClient.project.findMany({
      where: {
        userId: req.userId!,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        template: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      projects,
    });
  } catch (error: unknown) {
    console.error("Fetching projects failed:", error);

    return res.status(500).json({
      message: "Failed to fetch projects",
    });
  }
}

export async function getProjectById(
  req: AuthRequest,
  res: Response
) {
  const projectId = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

  if (!projectId) {
    return res.status(400).json({
      message: "Project ID is required",
    });
  }

  try {
    const project = await prismaClient.project.findFirst({
      where: {
        id: projectId,
        userId: req.userId!,
      },
      select: {
        id: true,
        name: true,
        description: true,
        template: true,
        status: true,
        workspace: {
          select: {
            id: true,
            status: true,
            accessUrl: true,
            startedAt: true,
            stoppedAt: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    return res.status(200).json({
      project,
    });
  } catch (error: unknown) {
    console.error("Fetching project failed:", error);

    return res.status(500).json({
      message: "Failed to fetch project",
    });
  }
}

export async function deleteProject(
  req: AuthRequest,
  res: Response
) {
  const projectId = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

  if (!projectId) {
    return res.status(400).json({
      message: "Project ID is required",
    });
  }

  try {
    // Ownership is checked in the delete query itself.
    const result = await prismaClient.project.deleteMany({
      where: {
        id: projectId,
        userId: req.userId!,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    return res.status(200).json({
      message: "Project deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Project deletion failed:", error);

    return res.status(500).json({
      message: "Failed to delete project",
    });
  }
}
