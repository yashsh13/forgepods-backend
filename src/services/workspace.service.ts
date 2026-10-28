import prismaClient from "../config/database/prismaClient.js";
import { getKubernetesClient } from "../infrastructure/kubernetes/kubernetes.client.js";
import { buildWorkspacePod } from "../infrastructure/kubernetes/workspace.manifests.js";
import { buildWorkspaceService } from "../infrastructure/kubernetes/workspace.manifests.js";

const NAMESPACE = process.env.K8S_NAMESPACE || "forgepods";

function getPodName(projectId: string): string {
  const safeId = projectId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  return `forgepods-${safeId}`
    .slice(0, 63)
    .replace(/-+$/, "");
}

export async function createWorkspace(
  projectId: string,
  userId: string,
) {
  // Check ownership before returning any workspace information.
  const project = await prismaClient.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    include: {
      workspace: true,
    },
  });

  if (!project) {
    return null;
  }

  // Avoid creating duplicate Pods for repeated requests.
  if (project.workspace) {
    return project.workspace;
  }

  const podName = getPodName(projectId);

  // Record the workspace in PostgreSQL first.
  const workspace = await prismaClient.workspace.create({
    data: {
      projectId,
      podName,
      namespace: NAMESPACE,
      containerName: "code-server",
      image: "codercom/code-server:latest",
      status: "PENDING",
    },
  });

  try {
    const pod = buildWorkspacePod({
      projectId,
      userId,
      namespace: NAMESPACE,
    });

    const kubernetes = getKubernetesClient();

    await kubernetes.createNamespacedPod({
      namespace: NAMESPACE,
      body: pod,
    });

    const service = buildWorkspaceService({
        projectId,
        namespace: NAMESPACE,
    });

    await kubernetes.createNamespacedService({
        namespace: NAMESPACE,
        body: service,
    });

    // Pod creation was accepted. It is not necessarily ready yet.
    return await prismaClient.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        status: "CREATING",
        errorMessage: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Unknown Kubernetes error";

    await prismaClient.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    throw new Error("Failed to create workspace");
  }
}


export async function getWorkspace(
  projectId: string,
  userId: string,
) {
  const project = await prismaClient.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    include: {
      workspace: true,
    },
  });

  if (!project) {
    return null;
  }

  const workspace = project.workspace;

  if (!workspace) {
    return null;
  }

  try {
    const kubernetes = getKubernetesClient();

    if (!workspace.podName) {
      return await prismaClient.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          status: "FAILED",
          errorMessage: "Workspace Pod name is missing.",
        },
      });
    }

    const response = await kubernetes.readNamespacedPod({
      name: workspace.podName,
      namespace: workspace.namespace,
    });

    const pod = response;

    const phase = pod.status?.phase;
    const containerStatuses = pod.status?.containerStatuses ?? [];

    const containerReady = containerStatuses.some(
      (container) =>
        container.name === workspace.containerName &&
        container.ready,
    );

    let status = workspace.status;

    if (phase === "Running" && containerReady) {
      status = "RUNNING";
    } else if (
      phase === "Failed" ||
      phase === "Unknown" ||
      phase === "Succeeded"
    ) {
      status = "FAILED";
    } else if (phase === "Pending") {
      status = "CREATING";
    }

    if (status !== workspace.status) {
      return await prismaClient.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          status,
          ...(status === "RUNNING"
            ? { startedAt: new Date() }
            : {}),
          ...(status === "FAILED"
            ? {
                errorMessage: `Kubernetes Pod phase: ${phase}`,
              }
            : {}),
        },
      });
    }

    return workspace;
  } catch (error: unknown) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? (error as { code?: number }).code
        : undefined;

    const httpStatus =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    // A missing Pod means the workspace is no longer available.
    if (statusCode === 404 || httpStatus === 404) {
      return await prismaClient.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          status: "FAILED",
          errorMessage: "Workspace Pod was not found in Kubernetes.",
        },
      });
    }

    console.error("Failed to check Kubernetes Pod status:", error);

    // Don't mark the workspace failed just because Kubernetes
    // couldn't be reached temporarily.
    return workspace;
  }
}


export async function deleteWorkspace(
  projectId: string,
  userId: string,
) {
  const project = await prismaClient.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    include: {
      workspace: true,
    },
  });

  if (!project) {
    return null;
  }

  const workspace = project.workspace;

  if (!workspace) {
    return null;
  }

  // Remove the actual Pod before deleting its database record.
  if (workspace.podName) {
    try {
      const kubernetes = getKubernetesClient();

      await kubernetes.deleteNamespacedPod({
        name: workspace.podName,
        namespace: workspace.namespace,
      });
    } catch (error: unknown) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? (error as { code?: number }).code
          : undefined;

      const status =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;

      // A Pod that is already gone needs no further cleanup.
      if (statusCode !== 404 && status !== 404) {
        throw new Error("Failed to delete workspace Pod");
      }
    }
  }

    if (workspace.podName) {
    try {
        const kubernetes = getKubernetesClient();

        await kubernetes.deleteNamespacedService({
        name: workspace.podName,
        namespace: workspace.namespace,
        });
    } catch (error: unknown) {
        const statusCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error
            ? (error as { code?: number }).code
            : undefined;

        const status =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;

        if (statusCode !== 404 && status !== 404) {
        throw new Error("Failed to delete workspace Service");
        }
    }
    }


  await prismaClient.workspace.delete({
    where: {
      id: workspace.id,
    },
  });

  return { deleted: true, projectId };
}

