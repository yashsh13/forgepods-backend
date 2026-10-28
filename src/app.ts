import express, { type Express } from "express";
import parsedEnv from "./config/env.js";
import authRouter from "./routes/auth.routes.js";
import authenticateToken, {
  type AuthRequest,
} from "./middleware/auth.middleware.js";
import projectRouter from "./routes/project.routes.js";
import cors from "cors";

const app: Express = express();

app.use(
  cors({
    origin: "http://localhost:3001",
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  return res.json({
    message: `Server healthy on PORT: ${parsedEnv.PORT}`,
  });
});

app.get(
  "/api/auth/me",
  authenticateToken,
  (req: AuthRequest, res) => {
    return res.json({
      userId: req.userId,
    });
  }
);

app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);

export default app;

