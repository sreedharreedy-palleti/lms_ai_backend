const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const jobController = require('../controllers/jobController');

// Map endpoints to controller functions in step-by-step sequential order of the workflow

// Step 1: Health check to verify that backend services are active
router.get('/health', resumeController.getHealth);

// Step 2: Upload and extract/parse structured data from a resume PDF
router.post('/extract-resume', resumeController.extractResume);

// Step 3: Retrieve available job postings from the database
router.get('/jobs', jobController.getJobs);

// Step 4: Compare resume text against a specific job description
router.post('/match-jd', resumeController.matchJD);

// Step 5: Evaluate resume suitability for a custom role and experience level
router.post('/match-role', resumeController.matchRole);

module.exports = router;
