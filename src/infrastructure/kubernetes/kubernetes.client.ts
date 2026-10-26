import {
  KubeConfig,
  CoreV1Api,
} from "@kubernetes/client-node";

let coreV1Api: CoreV1Api | undefined;

export function getKubernetesClient(): CoreV1Api {
  if (coreV1Api) {
    return coreV1Api;
  }

  const kubeConfig = new KubeConfig();

  // Loads Kubernetes credentials from the standard kubeconfig
  // file or the environment in which the backend is running.
  kubeConfig.loadFromDefault();

  coreV1Api = kubeConfig.makeApiClient(CoreV1Api);

  return coreV1Api;
}
