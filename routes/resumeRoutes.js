const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const jobController = require('../controllers/jobController');

// Modular Controllers for Recruiter Tasks
const rankController = require('../controllers/rankController');
const summaryController = require('../controllers/summaryController');

const emailController = require('../controllers/emailController');
const atsController = require('../controllers/atsController');

const analyticsController = require('../controllers/analyticsController');

// Map endpoints to controller functions in step-by-step sequential order of the workflow

// Step 1: Health check to verify that backend services are active
router.get('/health', resumeController.getHealth);

// Sandbox Demo Route
router.get('/demo', resumeController.getDemoData);

// Step 2: Upload and extract/parse structured data from a resume PDF
router.post('/extract-resume', resumeController.extractResume);

// Step 3: Retrieve available job postings from the database
router.get('/jobs', jobController.getJobs);

// Step 4: Compare resume text against a specific job description
router.post('/match-jd', resumeController.matchJD);

// Step 5: Evaluate resume suitability for a custom role and experience level
router.post('/match-role', resumeController.matchRole);

// Step 6: Fetch, rank, and manage candidates based on AI score (CRUD operations)
router.get('/admin/candidates', rankController.getCandidates);
router.post('/admin/candidates', rankController.createCandidate);
router.put('/admin/candidates/:id', rankController.updateCandidate);
router.delete('/admin/candidates/:id', rankController.deleteCandidate);

// Step 7: Generate AI candidate profile summary
router.get('/admin/candidates/:id/summary', summaryController.getCandidateSummary);



// Step 9: Personalize and generate interview invitation email draft
router.post('/admin/candidates/:id/invitation-email', emailController.getCandidateEmail);

// Step 10: Fetch detailed ATS score breakdown and recommendations
router.get('/admin/candidates/:id/ats-analysis', atsController.getCandidateAtsAnalysis);



// Step 12: Aggregate database analytics and stats
router.get('/admin/analytics', analyticsController.getAnalytics);

module.exports = router;
