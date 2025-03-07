const express =require('express')
const mongoose=require('mongoose')
require("dotenv").config()
const workoutRoutes = require('./routes/workout')
const userRoutes = require('./routes/user')
//Creates an express app
const app= express()

//Middleware
app.use(express.json())

app.get('/',(req,res,next)=>{
    console.log(req.path, req.method);
    next();
})

//Routes
// app.get('/',(req,res)=>{
//     res.json({mssg: "Welcome to the app"})
// })

//Connect to DB
mongoose.connect(process.env.MONGO_URI)
.then((req,res)=>
//Listen for request
app.listen(process.env.PORT, ()=>{
    console.log('Connected to DB and Listening on port', process.env.PORT)
}))
.catch((err)=>console.log(err));

app.use('/api/workouts',workoutRoutes)
app.use('/api/user',userRoutes)



process.env