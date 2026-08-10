const { ai, invitationEmailSchema } = require('../config/gemini');
const Resume = require('../models/Resume');

const getCandidateEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { jobTitle, companyName, recruiterName, interviewType } = req.body;
        const candidate = await Resume.findById(id);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found.' });
        }

        const candidateName = candidate.parsedData.name || 'Candidate';
        const role = jobTitle || 'Software Engineer';
        const company = companyName || 'our company';
        const recruiter = recruiterName || 'Recruiting Team';
        const type = interviewType || 'technical interview';

        let emailDraft = null;
        if (ai) {
            try {
                console.log(`Drafting interview invitation email for candidate ${candidateName}...`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: `Draft a personalized, warm, and professional interview invitation email for candidate "${candidateName}" who applied for the "${role}" position at "${company}".
The interview type is a "${type}".
The recruiter name is "${recruiter}".
Include placeholders like [Date/Time Options] for scheduling. Format as a JSON object with subject and body.`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: invitationEmailSchema
                    }
                });

                if (response.text) {
                    emailDraft = JSON.parse(response.text);
                }
            } catch (err) {
                console.error('Gemini email drafting failed:', err);
            }
        }

        if (!emailDraft) {
            emailDraft = {
                subject: `Interview Invitation: ${role} at ${company}`,
                body: `Dear ${candidateName},\n\nThank you for your application for the ${role} position at ${company}. We were very impressed by your background and experience.\n\nWe would like to invite you for a ${type} with our team. This will be an opportunity to discuss your experience in more detail and learn more about the role.\n\nPlease let us know your availability for a 45-minute video call during the following times:\n- [Option 1: Date & Time]\n- [Option 2: Date & Time]\n- [Option 3: Date & Time]\n\nIf none of these work, please feel free to suggest times that fit your schedule.\n\nWe look forward to speaking with you!\n\nBest regards,\n\n${recruiter}\n${company}`
            };
        }

        return res.status(200).json({ success: true, email: emailDraft });
    } catch (error) {
        console.error('Error generating invitation email:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate invitation email.' });
    }
};

module.exports = {
    getCandidateEmail
};
