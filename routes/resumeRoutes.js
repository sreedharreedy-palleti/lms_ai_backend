const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const jobController = require('../controllers/jobController');

// Modular Controllers for Recruiter Tasks
const rankController = require('../controllers/rankController');
const summaryController = require('../controllers/summaryController');
const questionController = require('../controllers/questionController');
const emailController = require('../controllers/emailController');
const atsController = require('../controllers/atsController');
const chatbotController = require('../controllers/chatbotController');
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

// Step 6: Fetch and rank candidates based on AI score
router.get('/candidates', rankController.getCandidates);

// Step 7: Generate AI candidate profile summary
router.get('/candidates/:id/summary', summaryController.getCandidateSummary);

// Step 8: Generate customized interview questions based on candidate resume
router.get('/candidates/:id/interview-questions', questionController.getCandidateQuestions);

// Step 8b: Generate customized interview questions based on job description and resume
router.post('/jobs/interview-questions', questionController.getJobInterviewQuestions);

// Step 9: Personalize and generate interview invitation email draft
router.post('/candidates/:id/invitation-email', emailController.getCandidateEmail);

// Step 10: Fetch detailed ATS score breakdown and recommendations
router.get('/candidates/:id/ats-analysis', atsController.getCandidateAtsAnalysis);

// Step 11: AI recruiter assistant chatbot for candidate/pool queries
router.post('/chatbot', chatbotController.handleChatbotQuery);

// Step 12: Aggregate database analytics and stats
router.get('/analytics', analyticsController.getAnalytics);

module.exports = router;
