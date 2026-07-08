import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import videosRouter from "./videos.js";
import settingsRouter from "./settings.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(videosRouter);
router.use(settingsRouter);

export default router;
