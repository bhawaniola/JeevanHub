const PrakritiAssessment = require("../models/PrakritiAssessment");
const Patient = require("../models/Patient");

// 1. Submit or Update an Assessment
exports.submitAssessment = async (req, res) => {
    if (req.user.role !== 'patient') {
        return res.status(403).json({ error: 'Access denied. Only patients can submit assessments.' });
    }
    try {
        const { answers, results } = req.body;
        const patientId = req.user._id;

        const responseArray = Object.keys(answers).map((id) => {
            let type = "vata"; // Default fallback
            if (id.startsWith('k')) type = "kapha";
            else if (id.startsWith('p')) type = "pitta";
            else if (id.startsWith('v')) type = "vata";

            return {
                questionId: id,
                doshaType: type,
                score: answers[id]
            };
        });

        // Use findOneAndUpdate with { upsert: true }
        const assessment = await PrakritiAssessment.findOneAndUpdate(
            { patientId: patientId }, // Search criteria
            {
                responses: responseArray,
                calculatedScores: results.percentages,
                dominantDosha: results.prakritiType,
                isAssessmentComplete: true
            },
            {
                new: true,      // Return the updated doc
                upsert: true,   // Create if it doesn't exist
                runValidators: true // CRITICAL: Validate the Enums before saving
            }
        );

        await Patient.findByIdAndUpdate(patientId, {
            hasTakenAssessment: true,
            lastAssessmentDate: new Date()
        });

        return res.status(200).json({
            message: "Assessment saved/updated successfully",
            assessment
        });
    } catch (error) {
        console.error("Error saving assessment:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// 2. Fetch the latest Assessment for a patient
exports.getPrakritiAssessment = async (req, res) => {
    try {
        // Find the most recent assessment
        const assessment = await PrakritiAssessment.findOne({
            // If you have patientId in params, use that, otherwise lookup by email via Patient model
            patientId: req.user._id
        }).sort({ createdAt: -1 });

        if (!assessment) {
            return res.status(200).json(null);
        }

        return res.status(200).json(assessment);
    } catch (error) {
        console.error("Error fetching assessment:", error);
        return res.status(500).json({ error: "Server error" });
    }
};

// 3. Delete Assessment (Optional)
exports.deleteAssessment = async (req, res) => {
    try {
        const assessment = await PrakritiAssessment.findById(req.params.id);
        if (!assessment) {
            return res.status(404).json({ error: "Assessment not found" });
        }
        if (assessment.patientId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized to delete this assessment" });
        }

        await PrakritiAssessment.findByIdAndDelete(req.params.id);

        // Optionally reset patient boolean if no other assessments exist
        const remaining = await PrakritiAssessment.countDocuments({ patientId: req.user._id });
        if (remaining === 0) {
            await Patient.findByIdAndUpdate(req.user._id, { hasTakenAssessment: false });
        }

        res.status(200).json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Delete failed" });
    }
};