const { ai, interviewQuestionsSchema } = require('../config/gemini');
const Resume = require('../models/Resume');

const getCandidateQuestions = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Resume.findById(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }

        if (candidate.interviewQuestions && candidate.interviewQuestions.length > 0) {
            return res.status(200).json({ success: true, questions: candidate.interviewQuestions });
        }

        let questions = [];
        if (ai && candidate.rawText) {
            try {
                console.log(`Generating interview questions for candidate ${candidate.parsedData.name}...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `Analyze the candidate's resume text and generate 5 targeted interview questions (a mix of technical, behavioral, and resume-specific questions). For each question, specify the type and include expected answer guidelines for the recruiter.
                    
Candidate Resume Text:
${candidate.rawText}`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: interviewQuestionsSchema
                    }
                });

                if (response.text) {
                    const result = JSON.parse(response.text);
                    questions = result.questions || [];
                    
                    candidate.interviewQuestions = questions;
                    await candidate.save();
                }
            } catch (err) {
                console.error('Gemini questions generation failed:', err);
            }
        }

        if (questions.length === 0) {
            const languages = candidate.parsedData.skills.languages || ['JavaScript'];
            const firstLang = languages[0] || 'software development';
            questions = [
                {
                    question: `Can you describe your experience working with ${firstLang} and explain a challenging technical problem you solved using it?`,
                    type: 'Technical',
                    expectedAnswer: 'Should mention specific language features, debugging processes, and a clear problem-solving methodology.'
                },
                {
                    question: 'Can you tell us about a time you had to adapt to a new framework or tool quickly for a project?',
                    type: 'Behavioral',
                    expectedAnswer: 'Should explain the learning process, resourcefulness, and successfully applying the new tool to deliver results.'
                },
                {
                    question: 'Walk us through one of the major projects listed in your resume and discuss your individual contribution.',
                    type: 'Resume-specific',
                    expectedAnswer: 'Candidate should clearly separate their own work from the team, showing ownership and clear communication.'
                },
                {
                    question: 'How do you ensure code quality and performance in your software applications?',
                    type: 'Technical',
                    expectedAnswer: 'Should mention code reviews, testing frameworks, CI/CD pipelines, and profiling tools.'
                },
                {
                    question: 'What is your preferred methodology for working in a team (e.g. Agile/Scrum) and how do you handle team conflicts?',
                    type: 'Behavioral',
                    expectedAnswer: 'Look for collaboration skills, understanding of team ceremonies, and a professional, respectful conflict resolution strategy.'
                }
            ];
        }

        return res.status(200).json({ success: true, questions });
    } catch (error) {
        console.error('Error generating interview questions:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate interview questions.' });
    }
};

const getJobInterviewQuestions = async (req, res) => {
    try {
        const { resumeText, jobTitle, jobDescription } = req.body;
        if (!resumeText || !jobTitle) {
            return res.status(400).json({ success: false, error: 'Both resumeText and jobTitle are required.' });
        }

        let questions = [];
        if (ai) {
            try {
                console.log(`Generating job-specific interview questions for role "${jobTitle}"...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `Analyze the candidate's resume text against a target Job Title: "${jobTitle}" and Job Description: "${jobDescription || ''}".
Generate 5 targeted interview questions tailored specifically to evaluate the candidate's suitability for this job. Provide a mix of technical, behavioral, and resume-specific questions. For each question, specify the type and include expected answer guidelines for the recruiter.

Job Description:
${jobDescription || 'Not specified'}

Candidate Resume Text:
${resumeText}`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: interviewQuestionsSchema
                    }
                });

                if (response.text) {
                    const result = JSON.parse(response.text);
                    questions = result.questions || [];
                }
            } catch (err) {
                console.error('Gemini job-specific questions generation failed:', err);
            }
        }

        if (questions.length === 0) {
            questions = [
                {
                    question: `Based on your resume, how would you apply your technical skills to succeed as a ${jobTitle}?`,
                    type: 'Technical',
                    expectedAnswer: `Should reference candidate's key skills matching the job title and description.`
                },
                {
                    question: `In this job description, we emphasize collaboration. Can you share an example from your resume where you worked closely with cross-functional teams?`,
                    type: 'Behavioral',
                    expectedAnswer: 'Should describe team structure, candidate role, and clear collaborative outcomes.'
                },
                {
                    question: `What specific experience listed in your resume makes you uniquely qualified for the ${jobTitle} position?`,
                    type: 'Resume-specific',
                    expectedAnswer: 'Should highlight a key past project or experience closely related to the job description keywords.'
                },
                {
                    question: `How do you handle technical challenges or shifting requirements when delivering a project in a fast-paced environment?`,
                    type: 'Behavioral',
                    expectedAnswer: 'Look for adaptability, communication, and systematic problem solving.'
                },
                {
                    question: `Are there any specific tools or frameworks mentioned in the job description that you haven't used extensively, and how do you plan to get up to speed?`,
                    type: 'Technical',
                    expectedAnswer: 'Look for resourcefulness, learning enthusiasm, and previous experience learning new skills quickly.'
                }
            ];
        }

        return res.status(200).json({ success: true, questions });
    } catch (error) {
        console.error('Error generating job-specific questions:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate job interview questions.' });
    }
};

module.exports = {
    getCandidateQuestions,
    getJobInterviewQuestions
};
