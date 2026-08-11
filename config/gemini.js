const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini SDK client if API key is provided
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE' ? new GoogleGenAI({ apiKey }) : null;

// OpenAPI Schema for Structured Parsing
const resumeSchema = {
    type: 'OBJECT',
    properties: {
        name: { type: 'STRING', description: "Candidate's full name" },
        email: { type: 'STRING', description: "Candidate's email address or empty string if missing" },
        phone: { type: 'STRING', description: "Candidate's phone number or empty string if missing" },
        linkedin: { type: 'STRING', description: "LinkedIn profile URL or empty string if missing" },
        github: { type: 'STRING', description: "GitHub profile URL or empty string if missing" },
        portfolio: { type: 'STRING', description: "Portfolio or personal website URL or empty string if missing" },
        skills: {
            type: 'OBJECT',
            properties: {
                languages: { type: 'ARRAY', items: { type: 'STRING' }, description: "Languages like JavaScript, TypeScript, Python, Java, SQL, C++, Go, etc." },
                frameworks: { type: 'ARRAY', items: { type: 'STRING' }, description: "Frameworks/libraries like React, Node.js, Express, Next.js, Redux, Tailwind, Django, etc." },
                tools: { type: 'ARRAY', items: { type: 'STRING' }, description: "DevOps, databases & Cloud tools like AWS, Docker, Kubernetes, Git, GitHub, PostgreSQL, MongoDB, Redis, etc." },
                concepts: { type: 'ARRAY', items: { type: 'STRING' }, description: "Methodologies and concepts like Agile, Scrum, REST API, System Design, Unit Testing, CI/CD, etc." }
            },
            required: ['languages', 'frameworks', 'tools', 'concepts']
        },
        sections: {
            type: 'OBJECT',
            properties: {
                experience: { type: 'BOOLEAN', description: "True if work experience/history section is present in text" },
                education: { type: 'BOOLEAN', description: "True if education/academic section is present in text" },
                skills: { type: 'BOOLEAN', description: "True if skills/expertise section is present in text" },
                projects: { type: 'BOOLEAN', description: "True if projects/portfolio section is present in text" }
            },
            required: ['experience', 'education', 'skills', 'projects']
        },
        score: { type: 'INTEGER', description: "An overall ATS formatting and content completeness score from 0 to 100" },
        rating: { type: 'STRING', description: "ATS Rating based on score (e.g. Excellent for >=90, Good for >=70, Fair for >=50, Weak for <50)" },
        tips: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    type: { type: 'STRING', description: "The type of tip: danger, warning, info, success" },
                    message: { type: 'STRING', description: "Actionable suggestion to improve the resume." }
                },
                required: ['type', 'message']
            }
        }
    },
    required: ['name', 'email', 'phone', 'linkedin', 'github', 'portfolio', 'skills', 'sections', 'score', 'rating', 'tips']
};

const matchRoleSchema = {
    type: 'OBJECT',
    properties: {
        score: { type: 'INTEGER', description: "ATS matching score from 0 to 100" },
        rating: { type: 'STRING', description: "Match Rating (Excellent, Good, Fair, Weak) based on score" },
        matchedSkills: { type: 'ARRAY', items: { type: 'STRING' }, description: "Skills present in the resume that match the target role" },
        missingSkills: { type: 'ARRAY', items: { type: 'STRING' }, description: "Required skills for the target role that are missing from the resume" },
        recommendations: { type: 'STRING', description: "Actionable summary advice for the candidate to improve their fit for this role" },
        tips: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    type: { type: 'STRING', description: "The type of tip: danger, warning, info, success" },
                    message: { type: 'STRING', description: "Specific actionable tip text" }
                },
                required: ['type', 'message']
            }
        },
        questions: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    question: { type: 'STRING', description: "The interview question text" },
                    type: { type: 'STRING', description: "Type of question: Technical, Behavioral, Resume-specific" },
                    expectedAnswer: { type: 'STRING', description: "Guideline of what a good response from the candidate should include" }
                },
                required: ['question', 'type', 'expectedAnswer']
            },
            description: "5 targeted interview questions tailored specifically to evaluate the candidate's suitability for this role"
        }
    },
    required: ['score', 'rating', 'matchedSkills', 'missingSkills', 'recommendations', 'tips', 'questions']
};

const matchJdSchema = {
    type: 'OBJECT',
    properties: {
        matchScore: { type: 'INTEGER', description: "ATS matching score from 0 to 100" },
        rating: { type: 'STRING', description: "Match Rating (Excellent, Good, Fair, Weak) based on score" },
        matchedSkills: { type: 'ARRAY', items: { type: 'STRING' }, description: "Skills present in the resume that match the job description" },
        missingSkills: { type: 'ARRAY', items: { type: 'STRING' }, description: "Skills requested in the job description that are missing from the resume" },
        recommendations: { type: 'STRING', description: "Actionable summary advice for the candidate to improve their fit for this job description" },
        tips: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    type: { type: 'STRING', description: "The type of tip: danger, warning, info, success" },
                    message: { type: 'STRING', description: "Specific actionable tip text" }
                },
                required: ['type', 'message']
            }
        },
        questions: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    question: { type: 'STRING', description: "The interview question text" },
                    type: { type: 'STRING', description: "Type of question: Technical, Behavioral, Resume-specific" },
                    expectedAnswer: { type: 'STRING', description: "Guideline of what a good response from the candidate should include" }
                },
                required: ['question', 'type', 'expectedAnswer']
            },
            description: "5 targeted interview questions tailored specifically to evaluate the candidate's suitability for this job"
        }
    },
    required: ['matchScore', 'rating', 'matchedSkills', 'missingSkills', 'recommendations', 'tips', 'questions']
};

const interviewQuestionsSchema = {
    type: 'OBJECT',
    properties: {
        questions: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    question: { type: 'STRING', description: "The interview question text" },
                    type: { type: 'STRING', description: "Type of question: Technical, Behavioral, Resume-specific" },
                    expectedAnswer: { type: 'STRING', description: "Guideline of what a good response from the candidate should include" }
                },
                required: ['question', 'type', 'expectedAnswer']
            }
        }
    },
    required: ['questions']
};

const invitationEmailSchema = {
    type: 'OBJECT',
    properties: {
        subject: { type: 'STRING', description: "Personalized subject line for the email" },
        body: { type: 'STRING', description: "Personalized email body content including placeholders like [Date], [Time] etc." }
    },
    required: ['subject', 'body']
};

module.exports = {
    ai,
    resumeSchema,
    matchRoleSchema,
    matchJdSchema,
    interviewQuestionsSchema,
    invitationEmailSchema
};
