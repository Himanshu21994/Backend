// import ('dotenv').config({path: './.env'});
import  dotenv from "dotenv";
import { app } from "./app.js";
import mongoose from "mongoose";
import connectDB from "./db/index.js";

dotenv.config({
    path: './.env'
});



connectDB().then(()=> {
    app.on("error", (err) => {
        console.error("ERROR: ", err);
        throw err;
    });
    app.listen(process.env.PORT || 8000, ()=> {
        console.log(`Server started at http://localhost:${process.env.PORT || 8000}`);
    });
})
.catch((err) => {
    console.log("MongoDB connection error: ", err);
});









/*
import express from "express";

const app = express();

;( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (err) => {
            console.error("ERROR: ", err);
            throw err;
        });
        app.listen(process.env.PORT, ()=> {
            console.log(`Server started at http://localhost:${process.env.PORT}`);
        })
    }catch(err){
        console.error("ERROR: ", err);
        throw err;
    }
})()
*/