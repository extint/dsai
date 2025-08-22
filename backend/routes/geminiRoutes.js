const express = require('express')
//Controller functions
const {analyzeCode, answerFollowUp, answerDSAQ, refreshContent, generateSkeletonCode, analyzeSubmission, answerCodeTask, assistiveAssess, getAvailableProviders, upload} = require('../controllers/answerDSAQuestion')

const router = express.Router()

router.post('/answerdsaquestion',answerDSAQ)
router.post('/answerfollowup',answerFollowUp)
router.post('/refresh',refreshContent)
router.post("/skeletoncode",generateSkeletonCode)
router.post("/code-query",answerCodeTask)
router.post("/analyze-code",analyzeCode)
router.post("/assistive-assess",assistiveAssess)
router.post("/avail-providers",getAvailableProviders)
// router.post('/api/analyze-submission', upload, analyzeSubmission);
router.post('/analyze-submission', (req, res, next) => {
    console.log("ROUTE CALLED"); next();
}, upload, analyzeSubmission);

module.exports= router