const { ai } = require('../config/gemini');
const Resume = require('../models/Resume');

const handleChatbotQuery = async (req, res) => {
    try {
        const { message, candidateId, history = [] } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required.' });
        }

        let context = '';

        if (candidateId) {
            const candidate = await Resume.findById(candidateId);
            if (candidate) {
                context = `Candidate Profile:
Name: ${candidate.parsedData.name}
Email: ${candidate.parsedData.email}
Phone: ${candidate.parsedData.phone}
Skills: ${JSON.stringify(candidate.parsedData.skills)}
ATS Score: ${candidate.parsedData.score}
ATS Rating: ${candidate.parsedData.rating}
Resume Text:
${candidate.rawText}`;
            }
        } else {
            const candidates = await Resume.find().sort({ createdAt: -1 }).limit(10);
            if (candidates.length > 0) {
                context = `We have ${candidates.length} candidates in our database:\n`;
                candidates.forEach((c, idx) => {
                    context += `Candidate ${idx + 1}:
Name: ${c.parsedData.name}
Email: ${c.parsedData.email}
ATS Score: ${c.parsedData.score}
ATS Rating: ${c.parsedData.rating}
Skills: Languages: ${(c.parsedData.skills.languages || []).join(', ')}, Frameworks: ${(c.parsedData.skills.frameworks || []).join(', ')}
---
`;
                });
            } else {
                context = 'No candidates are currently uploaded in the database.';
            }
        }

        let reply = '';
        if (ai) {
            try {
                console.log(`Sending query to chatbot...`);
                const contents = [];
                
                const systemInstruction = `You are a helpful recruitment AI assistant. You answer queries from recruiters about candidate resumes in our database.
Use the following database/candidate context to answer the user's questions:
${context}

Always be concise, professional, and base your answers on the provided resume context. If information is not in the text, say you don't know rather than making it up.`;

                history.forEach(h => {
                    contents.push({
                        role: h.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: h.content }]
                    });
                });

                contents.push({
                    role: 'user',
                    parts: [{ text: message }]
                });

                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: contents,
                    config: {
                        systemInstruction: systemInstruction
                    }
                });

                if (response.text) {
                    reply = response.text;
                }
            } catch (err) {
                console.error('Gemini chatbot failed:', err);
            }
        }

        if (!reply) {
            if (candidateId) {
                const term = message.toLowerCase();
                const candidate = await Resume.findById(candidateId);
                if (candidate) {
                    const hasTerm = candidate.rawText.toLowerCase().includes(term);
                    reply = `Based on a simple keyword scan for "${message}" in ${candidate.parsedData.name}'s resume: ${
                        hasTerm ? `Found matches. They have references to terms related to your query.` : `No direct mentions of "${message}" found.`
                    }`;
                } else {
                    reply = 'Candidate details could not be found to answer your query.';
                }
            } else {
                reply = 'I am currently unable to connect to the Gemini AI API to search across all candidates. Please check your network connection or GEMINI_API_KEY.';
            }
        }

        return res.status(200).json({ success: true, reply });
    } catch (error) {
        console.error('Error in chatbot endpoint:', error);
        return res.status(500).json({ success: false, error: 'Failed to process chatbot query.' });
    }
};

module.exports = {
    handleChatbotQuery
};
