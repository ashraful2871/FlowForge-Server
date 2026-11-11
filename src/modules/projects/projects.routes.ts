import { Router } from "express";
import { ProjectController } from "./projects.controller";

export const createProjectRouter = (): Router => {
  const router = Router();

  router.post("/", ProjectController.createProjectHandler);
  router.get("/", ProjectController.listProjectHandler);
  router.get("/:projectId", ProjectController.getProjectHandler);
  router.patch("/:projectId", ProjectController.updateProjectHandler);
  return router;
};
