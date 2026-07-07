import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import videosRouter from "./videos";
import aiRouter from "./ai";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(videosRouter);
router.use(aiRouter);
router.use(settingsRouter);

export default router;
