const express =require('express')
const cors = require('cors');
// const mongoose=require('mongoose')
require("dotenv").config()
const geminiRoutes = require('./routes/geminiRoutes')
const userRoutes = require('./routes/user')
const app= express()

app.use(cors());

//Middleware
app.use(express.json())

app.get('/',(req,res,next)=>{
    console.log(req.path, req.method);
    next();
})

//Connect to DB
// mongoose.connect(process.env.MONGO_URI)
// .then((req,res)=>
// //Listen for request
// app.listen(process.env.PORT, ()=>{
//     console.log('Connected to DB and Listening on port', process.env.PORT)
// }))
// .catch((err)=>console.log(err));

app.use('/api/user',userRoutes)
app.use('/answerq',geminiRoutes)

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});