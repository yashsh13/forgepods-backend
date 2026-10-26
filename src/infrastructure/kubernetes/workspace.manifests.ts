import type { V1Pod, V1Service } from "@kubernetes/client-node";


interface WorkspacePodOptions {
  projectId: string;
  userId: string;
  namespace?: string;
}

interface WorkspaceServiceOptions {
  projectId: string;
  namespace?: string;
}

export function buildWorkspacePod({
  projectId,
  userId,
  namespace = "forgepods",
}: WorkspacePodOptions): V1Pod {
  const safeProjectId = projectId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const safeUserId = userId.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const podName = `forgepods-${safeProjectId}`.slice(0, 63).replace(/-+$/, "");

  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: podName,
      namespace,
      labels: {
        app: "forgepods-workspace",
        "forgepods.io/project-id": safeProjectId,
        "forgepods.io/user-id": safeUserId,
      },
    },
    spec: {
      automountServiceAccountToken: false,
      restartPolicy: "Never",
      containers: [
                    {
                    name: "code-server",
                    image: "codercom/code-server:latest",
                    args: [
                        "--auth",
                        "none",
                        "--bind-addr",
                        "0.0.0.0:8080",
                        "/home/coder/project",
                    ],
                    ports: [
                        {
                        containerPort: 8080,
                        name: "http",
                        },
                    ],
                    resources: {
                        requests: {
                        cpu: "250m",
                        memory: "512Mi",
                        },
                        limits: {
                        cpu: "1",
                        memory: "1Gi",
                        },
                    },
                    securityContext: {
                        allowPrivilegeEscalation: false,
                        capabilities: {
                        drop: ["ALL"],
                        },
                    },
                    }
      ],
    },
  };
}

export function buildWorkspaceService({
  projectId,
  namespace = "forgepods",
}: WorkspaceServiceOptions): V1Service {
  const safeProjectId = projectId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 63)
    .replace(/-+$/, "");

  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `forgepods-${safeProjectId}`,
      namespace,
      labels: {
        app: "forgepods-workspace",
      },
    },
    spec: {
      type: "ClusterIP",
      selector: {
        app: "forgepods-workspace",
        "forgepods.io/project-id": safeProjectId,
      },
      ports: [
        {
          name: "http",
          port: 8080,
          targetPort: 8080,
          protocol: "TCP",
        },
      ],
    },
  };
}

