const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const jobController = require('../controllers/jobController');

// Map endpoints to controller functions
router.post('/extract-resume', resumeController.extractResume);
router.get('/health', resumeController.getHealth);
router.post('/match-jd', resumeController.matchJD);
router.get('/jobs', jobController.getJobs);
router.post('/match-role', resumeController.matchRole);
router.get('/demo', resumeController.getDemoData);

module.exports = router;
