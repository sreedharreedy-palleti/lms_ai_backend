const Resume = require('../models/Resume');

const getCandidates = async (req, res) => {
    try {
        const candidates = await Resume.find().sort({ 'parsedData.score': -1 });
        return res.status(200).json({
            success: true,
            candidates: candidates.map(c => {
                const parsed = c.parsedData || {};
                return {
                    id: c._id,
                    name: parsed.name || 'Unknown Candidate',
                    email: parsed.email || '',
                    phone: parsed.phone || '',
                    fileName: c.fileName,
                    score: parsed.score || 0,
                    rating: parsed.rating || 'Weak',
                    createdAt: c.createdAt,
                    skills: parsed.skills?.languages || []
                };
            })
        });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve and rank candidates.' });
    }
};

const createCandidate = async (req, res) => {
    try {
        const { name, email, phone, score, rating, skills } = req.body;
        const candidate = new Resume({
            fileName: 'Manual_Entry.pdf',
            fileSize: '0 KB',
            pageCount: '1',
            rawText: `Manually created candidate: ${name}. Skills: ${skills || ''}`,
            parsedData: {
                name: name || 'Unknown',
                email: email || '',
                phone: phone || '',
                score: Number(score) || 0,
                rating: rating || 'Weak',
                skills: {
                    languages: skills ? skills.split(',').map(s => s.trim()) : [],
                    frameworks: [],
                    tools: []
                },
                sections: {
                    experience: true,
                    education: true,
                    skills: true,
                    projects: true
                },
                tips: [
                    { type: 'info', message: 'Manually entered profile; AI recommendations are not fully generated.' }
                ]
            },
            interviewQuestions: [
                {
                    question: 'Can you describe your background and experience as entered in this profile?',
                    type: 'Behavioral',
                    expectedAnswer: 'Candidate should walk through their background and the skills listed in their profile.'
                }
            ]
        });

        await candidate.save();

        return res.status(201).json({
            success: true,
            message: 'Candidate created successfully.',
            candidate: {
                id: candidate._id,
                name: candidate.parsedData.name,
                email: candidate.parsedData.email,
                phone: candidate.parsedData.phone,
                fileName: candidate.fileName,
                score: candidate.parsedData.score,
                rating: candidate.parsedData.rating,
                createdAt: candidate.createdAt,
                skills: candidate.parsedData.skills?.languages || []
            }
        });
    } catch (error) {
        console.error('Error creating candidate:', error);
        return res.status(500).json({ success: false, error: 'Failed to create candidate.' });
    }
};

const updateCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, score, rating, skills } = req.body;

        const candidate = await Resume.findById(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }

        if (!candidate.parsedData) {
            candidate.parsedData = {
                skills: { languages: [], frameworks: [], tools: [], concepts: [] },
                sections: { experience: true, education: true, skills: true, projects: true },
                tips: []
            };
        }

        if (name !== undefined) candidate.parsedData.name = name;
        if (email !== undefined) candidate.parsedData.email = email;
        if (phone !== undefined) candidate.parsedData.phone = phone;
        if (score !== undefined) candidate.parsedData.score = Number(score);
        if (rating !== undefined) candidate.parsedData.rating = rating;
        if (skills !== undefined) {
            candidate.parsedData.skills = {
                languages: typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills,
                frameworks: candidate.parsedData.skills?.frameworks || [],
                tools: candidate.parsedData.skills?.tools || []
            };
        }

        candidate.markModified('parsedData');
        await candidate.save();

        return res.status(200).json({
            success: true,
            message: 'Candidate updated successfully.',
            candidate: {
                id: candidate._id,
                name: candidate.parsedData.name,
                email: candidate.parsedData.email,
                phone: candidate.parsedData.phone,
                fileName: candidate.fileName,
                score: candidate.parsedData.score,
                rating: candidate.parsedData.rating,
                createdAt: candidate.createdAt,
                skills: candidate.parsedData.skills?.languages || []
            }
        });
    } catch (error) {
        console.error('Error updating candidate:', error);
        return res.status(500).json({ success: false, error: 'Failed to update candidate.' });
    }
};

const deleteCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Resume.findByIdAndDelete(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }
        return res.status(200).json({ success: true, message: 'Candidate deleted successfully.' });
    } catch (error) {
        console.error('Error deleting candidate:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete candidate.' });
    }
};

module.exports = {
    getCandidates,
    createCandidate,
    updateCandidate,
    deleteCandidate
};
