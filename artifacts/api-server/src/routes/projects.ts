import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, videosTable } from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.createdAt);
  res.json(projects);
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/stats", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalProjects: sql<number>`count(distinct ${projectsTable.id})`,
      totalVideos: sql<number>`count(distinct ${videosTable.id})`,
    })
    .from(projectsTable)
    .leftJoin(videosTable, eq(videosTable.projectId, projectsTable.id));

  const [uploadedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(videosTable)
    .where(eq(videosTable.status, "uploaded"));

  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(videosTable)
    .where(eq(videosTable.status, "pending"));

  const [failedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(videosTable)
    .where(eq(videosTable.status, "failed"));

  const recentVideos = await db
    .select()
    .from(videosTable)
    .orderBy(videosTable.createdAt)
    .limit(5);

  res.json({
    totalProjects: Number(totals?.totalProjects ?? 0),
    totalVideos: Number(totals?.totalVideos ?? 0),
    uploadedVideos: Number(uploadedRow?.count ?? 0),
    pendingVideos: Number(pendingRow?.count ?? 0),
    failedVideos: Number(failedRow?.count ?? 0),
    recentVideos,
  });
});

export default router;
