const { ai } = require('../config/gemini');
const Resume = require('../models/Resume');

const getCandidateSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Resume.findById(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }

        if (candidate.parsedData.summary) {
            return res.status(200).json({ success: true, summary: candidate.parsedData.summary });
        }

        let summaryText = '';
        if (ai && candidate.rawText) {
            try {
                console.log(`Generating AI summary for candidate ${candidate.parsedData.name}...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `Write a concise and professional 3-4 sentence executive summary highlighting the candidate's core expertise, experience, strengths, and overall suitability based on the following resume text. Do not use markdown inside the summary text.
                    
Candidate Resume Text:
${candidate.rawText}`
                });

                if (response.text) {
                    summaryText = response.text.trim();
                    candidate.parsedData.summary = summaryText;
                    await candidate.save();
                }
            } catch (err) {
                console.error('Gemini candidate summary generation failed:', err);
            }
        }

        if (!summaryText) {
            const skills = [
                ...(candidate.parsedData.skills.languages || []),
                ...(candidate.parsedData.skills.frameworks || [])
            ].slice(0, 5).join(', ');
            summaryText = `${candidate.parsedData.name} is a software professional with expertise in technical skills including ${skills}. The candidate has a complete profile rated as ${candidate.parsedData.rating} with an overall suitability score of ${candidate.parsedData.score}/100.`;
        }

        return res.status(200).json({ success: true, summary: summaryText });
    } catch (error) {
        console.error('Error in getCandidateSummary:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate candidate summary.' });
    }
};

module.exports = {
    getCandidateSummary
};
