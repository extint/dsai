const express = require('express')
//Controller functions
const {verifyLC} = require('../controllers/verifyLC')

const router = express.Router()

router.post('/verifyLCSubmission',verifyLC)

module.exports= router