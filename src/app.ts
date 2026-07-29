import express, { type Express } from "express";

const app: Express = express();

app.get('/health', (req,res) => {
    return res.json({
        message: "Server healthy"
    })
})

export default app;
