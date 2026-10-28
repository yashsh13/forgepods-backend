import { Router } from "express";
import authenticateToken from "../middleware/auth.middleware.js";
import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
} from "../controllers/project.controller.js";
import {
  startWorkspace,
  workspaceStatus,
  stopWorkspace,
  openWorkspace
} from "../controllers/workspace.controller.js";

const projectRouter: Router = Router();

projectRouter.use(authenticateToken);

projectRouter.post("/", createProject);
projectRouter.get("/", getProjects);
projectRouter.get("/:id", getProjectById);
projectRouter.delete("/:id", deleteProject);
projectRouter.post("/:id/workspace", startWorkspace);
projectRouter.get("/:id/workspace", workspaceStatus);
projectRouter.delete("/:id/workspace", stopWorkspace);
projectRouter.post("/:id/open", openWorkspace);

export default projectRouter;
