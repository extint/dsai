const express = require('express')
//Controller functions
const {answerFollowUp, answerDSAQ, refreshContent, generateSkeletonCode} = require('../controllers/answerDSAQuestion')

const router = express.Router()

router.post('/answerdsaquestion',answerDSAQ)
router.post('/answerfollowup',answerFollowUp)
router.post('/refresh',refreshContent)
router.post("/skeletoncode",generateSkeletonCode)

module.exports= router