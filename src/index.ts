import app from "./app.js";
import parsedEnv from "./config/env.js";
import connectDB from "./config/database/connectDB.js";

await connectDB();

app.listen(parsedEnv.PORT,()=>{
    console.log("Server Running on port:",parsedEnv.PORT);
});