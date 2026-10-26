import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const envSchema = z.object({
    PORT: z.coerce.number(),
    NODE_ENV: z.enum(["development","production", "test"]),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string().min(32),
});

export type EnvType = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if(!parsedEnv.success){
    throw new Error(JSON.stringify(parsedEnv.error.issues, null, 2));
};

export default parsedEnv.data;