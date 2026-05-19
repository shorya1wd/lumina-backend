import {app} from "./app.js"
import dotenv from "dotenv"
import connectDB from "./db/connect.js"

const port=process.env.PORT || 3000

connectDB().then(()=>{
    app.listen(port,()=>{
    console.log(`server running on port ${port}`)
    })
}).catch(err=>{
    console.log("MongoDb error",err)
})

