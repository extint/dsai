const express=require('express')
const {
    createWorkout,
    getWorkout,
    getWorkouts,
    deleteWorkout,
    updateWorkout
} = require('../controllers/workoutController')
const requireAuth = require('../middleware/requireAuth')

const router =express.Router()

//Require Auth for all workout routes
router.use(requireAuth)

//To get all workouts
router.get('/',getWorkouts)

//Get a single workout
router.get('/:id',getWorkout)

//POST a new workout
router.post('/', createWorkout)

//Delete a workout
router.delete('/:id',deleteWorkout)

//Update a workout
router.patch('/:id',updateWorkout)
module.exports =router