const Workout =require('../models/workoutModel')
const mongoose =require("mongoose")
//Get all workouts
const getWorkouts= async(req,res)=>{
    const user_id= req.user._id
    const workouts=await Workout.find({user_id}).sort({createdAt: -1})
    res.status(200).json(workouts)
}

//Get a single workout
const getWorkout= async(req,res)=>{
    const {id} =req.params
    if(!mongoose.Types.ObjectId.isValid(id))
    {
        return res.status(404).json({error: "No such workout"})
    }
    const workout=await Workout.findById(id)
    if(!workout){
        return res.status(404).json({error: "No such workout"})
    }
    res.status(200).json(workout)
}

//Create new workout
const createWorkout= async(req,res)=>{
    const {title, reps, load} =req.body

    let emptyFields = []

    if(!title){
        emptyFields.push('Title')
    }
    if(!load){
        emptyFields.push('Load')
    }
    if(!reps){
        emptyFields.push('Reps')
    }
    if(emptyFields.length > 0){
        return res.status(400).json({error: 'Pls fill in all the fields',emptyFields})
    }
    //Add Doc to DB

    try{
        const user_id = req.user._id
        const workout= await Workout.create({title,reps,load,user_id})
        res.status(200).json(workout)
    }
    catch(error){res.status(404).json({error: error.message})}
    // res.json({msssg:"Post a new workout"})
}

//Delete a workout
const deleteWorkout= async(req,res)=>{
    const {id} =req.params
    if(!mongoose.Types.ObjectId.isValid(id))
    {
        return res.status(404).json({error: "No such workout"})
    }
    const workout=await Workout.findOneAndDelete({_id: id})
    if(!workout){
        return res.status(404).json({error: "No such workout"})
    }
    res.status(200).json(workout)
}

//Update a workout
const updateWorkout= async(req,res)=>{
    const {id} =req.params
    if(!mongoose.Types.ObjectId.isValid(id))
    {
        return res.status(404).json({error: "No such workout"})
    }
    const workout=await Workout.findOneAndUpdate({_id: id},{
        ...req.body //... from spreading the object
    })
    if(!workout){
        return res.status(404).json({error: "No such workout"})
    }
    res.status(200).json(workout)
}

module.exports={
    createWorkout,
    getWorkouts,
    getWorkout,
    deleteWorkout,
    updateWorkout
}