const { PDFParse } = require('pdf-parse');
const { ai, resumeSchema, matchRoleSchema, matchJdSchema, interviewQuestionsSchema, invitationEmailSchema } = require('../config/gemini');
const Resume = require('../models/Resume');
const { parseResumeTextHeuristic, calculateHeuristicRoleScore } = require('../services/heuristicService');

// Controller: Extract Resume PDF and call Gemini structured parser
const extractResume = async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'No resume file uploaded. Please upload a PDF.' });
        }

        const fileKey = Object.keys(req.files)[0];
        const resumeFile = req.files[fileKey];

        if (resumeFile.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'Invalid file type. Only PDF resumes are accepted.' });
        }

        const pdfBuffer = new Uint8Array(resumeFile.data);

        const parser = new PDFParse(pdfBuffer);
        const textResult = await parser.getText();
        const infoResult = await parser.getInfo();

        const extractedText = textResult.text ? textResult.text.trim() : '';

        let parsedData = null;
        if (ai && extractedText) {
            try {
                console.log(`Sending extracted text to Gemini API for structured parsing...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `You are an expert ATS (Applicant Tracking System) resume analyzer.
Analyze the following extracted resume text and parse it into structured JSON matching the provided schema.
Calculate an ATS score (0-100) and rating (Excellent/Good/Fair/Weak) based on the completeness, sections found, presence of contact details, and skill richness.
Generate appropriate formatting tips (e.g. warning if missing github/phone, info for layout recommendations, danger if missing email or major sections).

Resume Text:
${extractedText}`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: resumeSchema,
                    }
                });

                if (response.text) {
                    parsedData = JSON.parse(response.text);
                    console.log('Gemini Structured Parsing Success.');
                }
            } catch (geminiError) {
                console.error('Error during Gemini API parsing, falling back to heuristic parsing:', geminiError);
            }
        }

        if (!parsedData && extractedText) {
            console.log('Gemini parsing bypassed/failed. Executing backend heuristic fallback...');
            parsedData = parseResumeTextHeuristic(resumeFile.name, extractedText);
        }

        let dbSaved = false;
        if (extractedText) {
            try {
                const newResume = new Resume({
                    fileName: resumeFile.name,
                    fileSize: (resumeFile.size / 1024).toFixed(1) + ' KB',
                    pageCount: infoResult.total || 'Unknown',
                    rawText: extractedText,
                    parsedData: parsedData
                });

                await newResume.save();
                dbSaved = true;
                console.log('Successfully saved parsed resume to MongoDB.');
            } catch (dbError) {
                console.error('Error saving parsed resume to MongoDB:', dbError);
            }
        }

        return res.status(200).json({
            success: true,
            fileName: resumeFile.name,
            fileSize: resumeFile.size,
            pageCount: infoResult.total || 'Unknown',
            extractedText: extractedText,
            parsedData: parsedData,
            dbSaved: dbSaved
        });

    } catch (error) {
        console.error('Error parsing resume PDF:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to extract text from the PDF file.'
        });
    }
};

// Controller: Job Description Matching Algorithm
const matchJD = async (req, res) => {
    try {
        const { resumeText, jdText } = req.body;
        if (!resumeText || !jdText) {
            return res.status(400).json({ success: false, error: 'Both resumeText and jdText are required.' });
        }

        let parsedData = null;
        if (ai) {
            try {
                console.log(`Querying Gemini to match resume with Job Description...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `You are an expert ATS (Applicant Tracking System) recruiter.
Analyze the candidate's resume text against the provided job description.
Calculate a match score (0-100) and rating (Excellent/Good/Fair/Weak) based on how well the candidate's skills and experience align with the job description.
Identify matching skills (which exist in both), missing skills (requested in job description but missing or weak in resume), and actionable recommendations to improve the resume for this specific job description. Also generate formatting or key tips.

Job Description:
${jdText}

Resume Text:
${resumeText}`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: matchJdSchema
                    }
                });

                if (response.text) {
                    parsedData = JSON.parse(response.text);
                    console.log("Gemini JD Matching Success.");
                }
            } catch (err) {
                console.error("Gemini JD matching failed, falling back to heuristic:", err);
            }
        }

        if (parsedData) {
            return res.status(200).json({
                success: true,
                matchResult: parsedData
            });
        }

        // --- HEURISTIC FALLBACK ---
        console.log("Using heuristic fallback for JD matching...");
        const textLower = resumeText.toLowerCase();
        const jdLower = jdText.toLowerCase();

        const masterSkillList = [
            'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'sql', 'html5', 'html', 'css3', 'css', 'swift', 'kotlin', 'bash',
            'react', 'next.js', 'nextjs', 'vite', 'vue', 'angular', 'node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask', 'spring boot', 'redux', 'graphql', 'tailwind', 'sass', 'bootstrap',
            'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'github', 'ci/cd', 'jenkins', 'firebase', 'supabase', 'postgresql', 'mysql', 'mongodb', 'redis', 'linux', 'jest',
            'agile', 'scrum', 'system design', 'rest api', 'unit testing', 'project management', 'communication', 'team leadership', 'microservices'
        ];

        const jdSkills = [];
        masterSkillList.forEach(skill => {
            let matched = false;
            if (skill.includes('.') || skill.includes('/') || skill.includes('-') || skill.includes('+') || skill.includes('#')) {
                matched = jdLower.includes(skill);
            } else {
                const regex = new RegExp(`\\b${skill}\\b`, 'i');
                matched = regex.test(jdLower);
            }

            if (matched) {
                const displayName = skill === 'javascript' ? 'JavaScript'
                    : skill === 'typescript' ? 'TypeScript'
                        : skill === 'nodejs' || skill === 'node.js' ? 'Node.js'
                            : skill === 'nextjs' || skill === 'next.js' ? 'Next.js'
                                : skill === 'react' ? 'React'
                                    : skill === 'vue' ? 'Vue'
                                        : skill === 'angular' ? 'Angular'
                                            : skill === 'html' || skill === 'html5' ? 'HTML5'
                                                : skill === 'css' || skill === 'css3' ? 'CSS3'
                                                    : skill === 'sql' ? 'SQL'
                                                        : skill === 'aws' ? 'AWS'
                                                            : skill === 'gcp' ? 'GCP'
                                                                : skill === 'github' ? 'GitHub'
                                                                    : skill === 'postgresql' ? 'PostgreSQL'
                                                                        : skill === 'mongodb' ? 'MongoDB'
                                                                            : skill === 'mysql' ? 'MySQL'
                                                                                : skill === 'redis' ? 'Redis'
                                                                                    : skill === 'firebase' ? 'Firebase'
                                                                                        : skill === 'supabase' ? 'Supabase'
                                                                                            : skill === 'jest' ? 'Jest'
                                                                                                : skill === 'vite' ? 'Vite'
                                                                                                    : skill === 'express' ? 'Express'
                                                                                                        : skill === 'rest api' ? 'REST API'
                                                                                                            : skill === 'ci/cd' ? 'CI/CD'
                                                                                                                : skill.charAt(0).toUpperCase() + skill.slice(1);

                if (!jdSkills.includes(displayName)) {
                    jdSkills.push(displayName);
                }
            }
        });

        let matchedSkills = [];
        let missingSkills = [];
        let matchScore = 0;
        let recommendations = '';

        if (jdSkills.length === 0) {
            const stopwords = new Set(['the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'for', 'with', 'on', 'as', 'by', 'at', 'an', 'be', 'this', 'are', 'from', 'we', 'our', 'you', 'your', 'or', 'will']);
            const jdWords = jdLower.match(/[a-z]+/g) || [];
            const jdWordFreq = {};
            jdWords.forEach(w => {
                if (w.length > 4 && !stopwords.has(w)) {
                    jdWordFreq[w] = (jdWordFreq[w] || 0) + 1;
                }
            });

            const topKeywords = Object.entries(jdWordFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(entry => entry[0]);

            if (topKeywords.length > 0) {
                const matchedKeywords = topKeywords.filter(w => textLower.includes(w));
                const missingKeywords = topKeywords.filter(w => !textLower.includes(w));
                matchScore = Math.round((matchedKeywords.length / topKeywords.length) * 100);
                matchedSkills = matchedKeywords.map(w => w.charAt(0).toUpperCase() + w.slice(1));
                missingSkills = missingKeywords.map(w => w.charAt(0).toUpperCase() + w.slice(1));
                recommendations = missingKeywords.length > 0
                    ? `Incorporate these key terms from the job description to align keywords: ${missingKeywords.slice(0, 4).join(', ')}.`
                    : "Great word choice! Your resume shares a high similarity with the job description keywords.";
            } else {
                recommendations = "Provide a detailed job description containing key requirements to analyze matching metrics.";
            }
        } else {
            jdSkills.forEach(skill => {
                let matched = false;
                const skillLower = skill.toLowerCase();
                if (skillLower.includes('.') || skillLower.includes('/') || skillLower.includes('-') || skillLower.includes('+') || skillLower.includes('#')) {
                    matched = textLower.includes(skillLower);
                } else {
                    const regex = new RegExp(`\\b${skillLower}\\b`, 'i');
                    matched = regex.test(textLower);
                }

                if (matched) {
                    matchedSkills.push(skill);
                } else {
                    missingSkills.push(skill);
                }
            });

            matchScore = Math.round((matchedSkills.length / jdSkills.length) * 100);

            if (matchScore === 100) {
                recommendations = "Match rating: 100%! Your resume is perfectly aligned with the technical requirements in the job description.";
            } else if (matchScore >= 70) {
                recommendations = `Strong Match! Add standard descriptions highlighting your experience in: ${missingSkills.slice(0, 3).join(', ')} to maximize your score.`;
            } else if (matchScore >= 35) {
                recommendations = `Partial Match. You lack key skills like: ${missingSkills.slice(0, 4).join(', ')}. Mention these skills in your experience details if applicable.`;
            } else {
                recommendations = `Low Match. The job description emphasizes: ${missingSkills.slice(0, 5).join(', ')}. Tailor your CV to include experience in these fields.`;
            }
        }

        let rating = 'Weak';
        if (matchScore >= 90) rating = 'Excellent';
        else if (matchScore >= 70) rating = 'Good';
        else if (matchScore >= 50) rating = 'Fair';

        const tips = [];
        if (missingSkills.length > 0) {
            tips.push({ type: 'warning', message: `Add missing key technologies to maximize match: ${missingSkills.slice(0, 3).join(', ')}.` });
        } else {
            tips.push({ type: 'success', message: 'Perfect keyword overlap for this role!' });
        }

        return res.status(200).json({
            success: true,
            matchResult: {
                matchScore,
                rating,
                matchedSkills,
                missingSkills,
                recommendations,
                tips
            }
        });
    } catch (error) {
        console.error("Error in matchJD endpoint:", error);
        return res.status(500).json({ success: false, error: 'Failed to evaluate resume matching against Job Description.' });
    }
};


// Controller: Health Check Status
const getHealth = (req, res) => {
    return res.status(200).json({ success: true, status: 'OK' });
};

// Controller: Evaluate Resume for Custom Role and Experience
/**
 * POST `/api/match-role` Route Handler.
 * Evaluates candidate resume text against a target Job Title and Experience requirement.
 */
const matchRole = async (req, res) => {
    try {
        const { resumeText, role, experience } = req.body;
        if (!resumeText || !role) {
            return res.status(400).json({ success: false, error: 'Both resumeText and role are required.' });
        }

        let parsedData = null;
        if (ai) {
            try {
                console.log(`Querying Gemini model to match resume to custom role: "${role}"...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `You are an expert ATS (Applicant Tracking System) resume analyzer.
Analyze the following candidate's resume text against a target job role: "${role}" requiring "${experience || 'any'}" years of experience.
Calculate an ATS score (0-100) and rating (Excellent/Good/Fair/Weak) based on how well the candidate's skills and experience match this target role.
Generate matching skills, missing skills, and actionable recommendations/tips to improve the resume for this specific role.

Resume Text:
${resumeText}`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: matchRoleSchema
                    }
                });

                if (response.text) {
                    parsedData = JSON.parse(response.text);
                }
            } catch (err) {
                console.error("Gemini match-role parsing failed, falling back:", err);
            }
        }

        if (!parsedData) {
            parsedData = calculateHeuristicRoleScore(resumeText, role, experience);
        }

        return res.status(200).json({
            success: true,
            matchResult: parsedData
        });
    } catch (error) {
        console.error("Error in match-role endpoint:", error);
        return res.status(500).json({ success: false, error: 'Failed to evaluate resume for the target role.' });
    }
};
const getDemoData = async (req, res) => {
    try {
        const demoData = {
            name: "John Doe",
            email: "john.doe@example.com",
            phone: "+1 234 567 8901",
            skills: {
                languages: ["JavaScript", "TypeScript", "Python", "Java", "SQL", "HTML5", "CSS3"],
                frameworks: ["React", "Next.js", "Node.js", "Express", "Django", "Spring Boot"],
                tools: ["Git", "Docker", "AWS", "Kubernetes", "Firebase", "MongoDB", "PostgreSQL"],
                concepts: ["REST APIs", "Agile/Scrum", "CI/CD Pipelines", "System Design", "Microservices"]
            },
            experience: [
                {
                    role: "Senior Software Engineer",
                    company: "InnovateTech Solutions",
                    duration: "2023 - Present",
                    highlights: [
                        "Architected scalable microservices using Node.js and Docker, improving system throughput by 35%.",
                        "Led a team of 4 frontend engineers to rebuild the customer portal in React/Next.js, driving a 20% increase in user retention.",
                        "Integrated secure REST APIs and third-party payment gateways with AWS deployments."
                    ]
                },
                {
                    role: "Software Developer",
                    company: "Quantum Code Inc",
                    duration: "2021 - 2023",
                    highlights: [
                        "Designed and developed backend APIs using Python/Django and PostgreSQL.",
                        "Optimized database query performance, reducing page load latency by 450ms.",
                        "Participated in Agile Scrum ceremonies and wrote comprehensive unit tests."
                    ]
                }
            ],
            education: [
                {
                    degree: "Bachelor of Science in Computer Science",
                    school: "University of Tech",
                    year: "2017 - 2021"
                }
            ],
            projects: [
                {
                    name: "AI-Powered Resume Screener",
                    description: "An open-source ATS evaluation tool integrating LLM parsing to score resume-to-role matching criteria."
                }
            ],
            score: 80,
            rating: "Good",
            sections: {
                experience: true,
                education: true,
                skills: true,
                projects: true
            },
            tips: [
                { type: "info", message: "Resume format is well-structured and parsable." },
                { type: "warning", message: "Consider adding links to your GitHub portfolio to improve profile completeness." }
            ],
            rawText: "John Doe Senior Software Engineer Email: john.doe@example.com Phone: +1 234 567 8901 Skills: JavaScript, TypeScript, Python, React, Next.js, Node.js, Git, Docker, AWS, REST APIs. Experience: Senior Software Engineer at InnovateTech Solutions (2023-Present), Software Developer at Quantum Code Inc (2021-2023). Education: BS in Computer Science from University of Tech (2017-2021)."
        };

        return res.status(200).json({
            success: true,
            parsedData: demoData,
            fileName: "Demo_Resume.pdf",
            fileSize: 94100,
            pageCount: 1,
            extractedText: demoData.rawText
        });
    } catch (error) {
        console.error("Error fetching demo data:", error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve demo resume.' });
    }
};

module.exports = {
    extractResume,
    getHealth,
    matchJD,
    matchRole,
    getDemoData
};
