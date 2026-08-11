const Resume = require('../models/Resume');
const { ai, interviewQuestionsSchema } = require('../config/gemini');

const getCandidateAtsAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Resume.findById(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }

        // If interview questions are not generated yet, generate them
        let questions = candidate.interviewQuestions || [];
        if (questions.length === 0) {
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

            // Fallback questions if Gemini fails or is bypassed
            if (questions.length === 0) {
                const languages = candidate.parsedData?.skills?.languages || ['JavaScript'];
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
                candidate.interviewQuestions = questions;
                await candidate.save();
            }
        }

        const parsed = candidate.parsedData || {};
        return res.status(200).json({
            success: true,
            atsAnalysis: {
                score: parsed.score || 0,
                rating: parsed.rating || 'Weak',
                sectionsFound: parsed.sections || {},
                skillsFound: parsed.skills || {},
                tips: parsed.tips || [],
                fileName: candidate.fileName,
                fileSize: candidate.fileSize,
                questions: questions
            }
        });
    } catch (error) {
        console.error('Error retrieving ATS analysis:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve ATS analysis.' });
    }
};

module.exports = {
    getCandidateAtsAnalysis
};
