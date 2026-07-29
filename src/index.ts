import app from "./app.js";
import parsedEnv from "./config/env.js";

app.listen(parsedEnv.PORT,()=>{
    console.log("Server Running on port:",parsedEnv.PORT);
});