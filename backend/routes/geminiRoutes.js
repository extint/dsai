const express = require('express')
//Controller functions
const {answerFollowUp, answerDSAQ, refreshContent} = require('../controllers/answerDSAQuestion')

const router = express.Router()

router.post('/answerdsaquestion',answerDSAQ)
router.post('/answerfollowup',answerFollowUp)
router.post('/refresh',refreshContent)

module.exports= router