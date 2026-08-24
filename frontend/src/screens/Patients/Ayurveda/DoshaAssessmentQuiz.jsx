import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AuthContext } from "../../../context/AuthContext";
import { BACKEND_URL } from "../../../config";

const API = BACKEND_URL || "http://localhost:8080";

const OPTIONS = [
	{ label: "Never", value: 0 },
	{ label: "Rarely", value: 1 },
	{ label: "Sometimes", value: 2 },
	{ label: "Often", value: 3 },
	{ label: "Always", value: 4 },
];

// One statement per dosha per parameter group, 4/3/3 split covering the
// full Physical / Mental & Behavioral / Lifestyle parameter list from spec
// (body frame, weight tendency, skin/hair, temperature, digestion, appetite,
// sleep; energy, learning/memory, stress response, emotional patterns,
// decision-making; activity preferences, food cravings, routine patterns).
const CATEGORIES = [
	{
		key: "physical",
		title: "Physical Characteristics",
		questions: [
			{
				id: "ph_v1",
				doshaType: "vata",
				text: "Body Frame & Weight Tendency (Vata)",
				options: [
					{ label: "Solid, heavy frame; I gain weight very easily and find it hard to lose.", value: 0 },
					{ label: "Medium build; weight is stable and easy to manage.", value: 1 },
					{ label: "Light build; I occasionally lose weight when stressed but can regain it.", value: 2 },
					{ label: "Thin, light frame; I struggle to gain weight and lose it quickly.", value: 3 },
					{ label: "Extremely thin, delicate/tall frame with prominent joints; gaining weight is nearly impossible.", value: 4 }
				]
			},
			{
				id: "ph_v2",
				doshaType: "vata",
				text: "Skin & Hair Texture (Vata)",
				options: [
					{ label: "Smooth, oily, or thick skin and lustrous hair.", value: 0 },
					{ label: "Normal skin and hair with minimal dry spells.", value: 1 },
					{ label: "Mildly dry skin or frizzy hair, especially in dry weather.", value: 2 },
					{ label: "Noticeably dry, rough skin and brittle, split-end prone hair.", value: 3 },
					{ label: "Chronically dry, cracked skin and extremely thin, dry, coarse hair.", value: 4 }
				]
			},
			{
				id: "ph_v3",
				doshaType: "vata",
				text: "Cold Sensitivity & Digestion (Vata)",
				options: [
					{ label: "Warm hands/feet; strong, highly predictable appetite and digestion.", value: 0 },
					{ label: "Rarely feel unusually cold; digest most meals easily.", value: 1 },
					{ label: "Sometimes get cold extremities; appetite fluctuates occasionally with gas/bloating.", value: 2 },
					{ label: "Frequent cold hands/feet; unpredictable hunger and regular bloating or gas.", value: 3 },
					{ label: "Constant cold intolerance; highly erratic digestion (extreme bloating, gas, or constipation).", value: 4 }
				]
			},
			{
				id: "ph_v4",
				doshaType: "vata",
				text: "Sleep Pattern (Vata)",
				options: [
					{ label: "Deep, heavy sleep for 8+ hours; hard to wake up.", value: 0 },
					{ label: "Sound, moderate sleep; wake up feeling well-rested.", value: 1 },
					{ label: "Moderate sleep; occasionally wake up but fall back asleep easily.", value: 2 },
					{ label: "Light sleep; easily awakened by minor noises or thoughts; struggle to sleep soundly.", value: 3 },
					{ label: "Highly fitful, restless sleep (insomnia) with frequent waking; sleep less than 5-6 hours.", value: 4 }
				]
			},
			{
				id: "ph_p1",
				doshaType: "pitta",
				text: "Body Build (Pitta)",
				options: [
					{ label: "Thin/frail frame OR very broad/heavy frame.", value: 0 },
					{ label: "Moderately slim or stocky build without much muscle definition.", value: 1 },
					{ label: "Average build; can tone muscle with regular effort.", value: 2 },
					{ label: "Good muscle tone and athletic, medium-framed build.", value: 3 },
					{ label: "Well-defined, athletic, and symmetrical medium build; gain muscle easily.", value: 4 }
				]
			},
			{
				id: "ph_p2",
				doshaType: "pitta",
				text: "Skin Sensitivity & Hair (Pitta)",
				options: [
					{ label: "Cool, dry skin; thick, dark, coarse hair.", value: 0 },
					{ label: "Normal skin tolerance; hair is moderately thick and maintains natural color.", value: 1 },
					{ label: "Slightly warm skin; hair is somewhat fine or has early hints of thinning/greying.", value: 2 },
					{ label: "Warm, sensitive skin (occasional redness/sunburn); fine hair with noticeable thinning/greying.", value: 3 },
					{ label: "Highly sensitive, warm skin (frequent rashes, acne, easily sunburned); very fine, red/blonde or prematurely grey/bald hair.", value: 4 }
				]
			},
			{
				id: "ph_p3",
				doshaType: "pitta",
				text: "Temperature & Hunger (Pitta)",
				options: [
					{ label: "Prefer hot weather; slow digestion; rarely feel intense hunger.", value: 0 },
					{ label: "Moderate heat tolerance; normal appetite.", value: 1 },
					{ label: "Feel warm easily; get irritable if meals are delayed.", value: 2 },
					{ label: "Sweat easily; strong appetite; require regular meals to avoid acidity or anger.", value: 3 },
					{ label: "Intense heat intolerance; sweat heavily; sharp, intense hunger that must be satisfied immediately to prevent severe acidity/irritation.", value: 4 }
				]
			},
			{
				id: "ph_p4",
				doshaType: "pitta",
				text: "Sleep Quality (Pitta)",
				options: [
					{ label: "Deep sleep unaffected by room temperature or hunger.", value: 0 },
					{ label: "Consistent sleep, rarely wake up during the night.", value: 1 },
					{ label: "Average sleep; occasionally wake up if the room is too hot.", value: 2 },
					{ label: "Moderate sleep; wake up feeling hot or hungry, but can resume sleep after cooling down.", value: 3 },
					{ label: "Light-to-moderate sleep; frequently disrupted by night sweats, feeling hot, or midnight hunger.", value: 4 }
				]
			},
			{
				id: "ph_k1",
				doshaType: "kapha",
				text: "Frame & Weight Gain (Kapha)",
				options: [
					{ label: "Thin, bony frame; hard to gain any weight.", value: 0 },
					{ label: "Medium, balanced build; weight changes are moderate.", value: 1 },
					{ label: "Slightly heavy build; gain weight when inactive but can lose it with effort.", value: 2 },
					{ label: "Solid, broad frame; gain weight very easily and struggle to lose it.", value: 3 },
					{ label: "Very heavy, stocky, large frame; constant weight accumulation; extremely difficult to lose weight.", value: 4 }
				]
			},
			{
				id: "ph_k2",
				doshaType: "kapha",
				text: "Skin & Hair Quality (Kapha)",
				options: [
					{ label: "Very dry, rough skin; thin, sparse hair.", value: 0 },
					{ label: "Normal skin and hair with balanced oil production.", value: 1 },
					{ label: "Slightly oily skin (T-zone); moderately thick hair.", value: 2 },
					{ label: "Smooth, soft, cool skin (prone to oiliness); thick, wavy, strong hair.", value: 3 },
					{ label: "Thick, oily skin (prone to cystic acne); extremely dense, lustrous, thick hair.", value: 4 }
				]
			},
			{
				id: "ph_k3",
				doshaType: "kapha",
				text: "Digestion & Appetite (Kapha)",
				options: [
					{ label: "Cold extremities; sharp, frequent hunger; fast digestion.", value: 0 },
					{ label: "Normal body temperature; standard hunger patterns.", value: 1 },
					{ label: "Generally warm; occasionally feel heavy after eating.", value: 2 },
					{ label: "Stay warm easily; slow, sluggish digestion; can comfortably skip meals.", value: 3 },
					{ label: "Constant warmth; extremely slow digestion (food sits in stomach for hours); minimal appetite, yet still hold weight.", value: 4 }
				]
			},
			{
				id: "ph_k4",
				doshaType: "kapha",
				text: "Sleep Duration (Kapha)",
				options: [
					{ label: "Very light sleep; wake up early after 5-6 hours.", value: 0 },
					{ label: "Moderate sleep (7 hours); wake up easily with an alarm.", value: 1 },
					{ label: "Sound sleep (7-8 hours); feel slightly groggy if waking early.", value: 2 },
					{ label: "Deep sleep (8-9 hours); struggle to wake up; feel heavy in the morning.", value: 3 },
					{ label: "Extremely heavy sleep (9+ hours); nearly impossible to disturb; feel very groggy and sluggish even after long sleep.", value: 4 }
				]
			},
		],
	},
	{
		key: "mental_behavioral",
		title: "Mental and Behavioral Characteristics",
		questions: [
			{
				id: "m_v1",
				doshaType: "vata",
				text: "Energy & Learning Style (Vata)",
				options: [
					{ label: "Steady energy throughout the day; learn slowly but never forget.", value: 0 },
					{ label: "Balanced energy levels; standard pace of learning and retention.", value: 1 },
					{ label: "Occasional bursts of energy; fast learner, but sometimes need a refresher to retain.", value: 2 },
					{ label: "Noticeable energy fluctuations; pick up new concepts very quickly but forget them soon after.", value: 3 },
					{ label: "Extreme energy spikes followed by sudden crashes; grasp concepts instantly but lose them almost immediately unless applied.", value: 4 }
				]
			},
			{
				id: "m_v2",
				doshaType: "vata",
				text: "Stress Response & Mood (Vata)",
				options: [
					{ label: "Calm, unbothered, and emotionally stable under pressure; slow to anger or worry.", value: 0 },
					{ label: "Generally stable; feel minor worry but resolve it quickly.", value: 1 },
					{ label: "Moody at times; feel anxious under heavy pressure.", value: 2 },
					{ label: "Highly sensitive; respond to stress with worry, anxiety, fear, or feeling overwhelmed.", value: 3 },
					{ label: "Prone to extreme anxiety, panic, or racing thoughts under stress; mood swings are frequent and intense.", value: 4 }
				]
			},
			{
				id: "m_v3",
				doshaType: "vata",
				text: "Decision-Making (Vata)",
				options: [
					{ label: "Take my time to decide; once a decision is made, I almost never change my mind.", value: 0 },
					{ label: "Moderate decision-maker; standard deliberation and consistency.", value: 1 },
					{ label: "Feel hesitant; might change my mind once or twice on important matters.", value: 2 },
					{ label: "Indecisive; frequently change opinions and struggle to stick to a choice.", value: 3 },
					{ label: "Constant second-guessing and high indecisiveness; change my mind constantly and find it very difficult to make any firm decision.", value: 4 }
				]
			},
			{
				id: "m_p1",
				doshaType: "pitta",
				text: "Focus & Memory (Pitta)",
				options: [
					{ label: "Dreamy, easily distracted focus; remember things only through emotional association.", value: 0 },
					{ label: "General focus; normal memory retention.", value: 1 },
					{ label: "Fairly focused; remember details clearly when interested.", value: 2 },
					{ label: "Highly focused, sharp attention span; logical and analytical memory.", value: 3 },
					{ label: "Hyper-focused, laser-like concentration; extremely sharp, detail-oriented memory, and highly analytical.", value: 4 }
				]
			},
			{
				id: "m_p2",
				doshaType: "pitta",
				text: "Stress Response (Pitta)",
				options: [
					{ label: "Withdraw, stay quiet, or remain peaceful when stressed.", value: 0 },
					{ label: "Occasionally annoyed, but usually keep my cool.", value: 1 },
					{ label: "Impatient or critical under moderate pressure.", value: 2 },
					{ label: "Easily angered, irritable, or impatient; react defensively under stress.", value: 3 },
					{ label: "Explosive anger, severe impatience, or highly critical/confrontational behavior under pressure.", value: 4 }
				]
			},
			{
				id: "m_p3",
				doshaType: "pitta",
				text: "Decision-Making & Leadership (Pitta)",
				options: [
					{ label: "Prefer to follow; avoid leadership roles and dislike taking charge.", value: 0 },
					{ label: "Comfortable following; lead only when specifically asked.", value: 1 },
					{ label: "Decisive; comfortable sharing opinions and stepping up occasionally.", value: 2 },
					{ label: "Quick and confident decision-maker; naturally take charge and prefer to lead.", value: 3 },
					{ label: "Highly assertive and competitive; make decisions instantly and command leadership roles aggressively.", value: 4 }
				]
			},
			{
				id: "m_k1",
				doshaType: "kapha",
				text: "Energy & Retention (Kapha)",
				options: [
					{ label: "Hyperactive, high-energy spikes; forget things almost instantly.", value: 0 },
					{ label: "Good physical stamina; moderate retention.", value: 1 },
					{ label: "Steady energy; remember details long-term with minor effort.", value: 2 },
					{ label: "Very steady, enduring stamina; learn slowly but have excellent long-term memory retention.", value: 3 },
					{ label: "Immense physical endurance but slow/lethargic start; learn very slowly but possess a near-permanent, photographic long-term memory.", value: 4 }
				]
			},
			{
				id: "m_k2",
				doshaType: "kapha",
				text: "Stress Response (Kapha)",
				options: [
					{ label: "React with immediate anxiety, worry, or sharp anger when stressed.", value: 0 },
					{ label: "Mildly upset, but let go of stress quickly.", value: 1 },
					{ label: "Withdraw or seek comfort food under pressure.", value: 2 },
					{ label: "Avoid confrontation; react to stress by withdrawing, feeling low-energy, or holding onto things.", value: 3 },
					{ label: "Complete emotional shutdown, deep lethargy, depression, or heavy attachment/stubbornness under stress.", value: 4 }
				]
			},
			{
				id: "m_k3",
				doshaType: "kapha",
				text: "Decision-Making Style (Kapha)",
				options: [
					{ label: "Change decisions constantly; highly spontaneous.", value: 0 },
					{ label: "Moderate speed of decision-making; open to change.", value: 1 },
					{ label: "Take a while to make up my mind, but open to logical adjustments.", value: 2 },
					{ label: "Very deliberate and slow to decide; extremely resistant to changing my mind once decided.", value: 3 },
					{ label: "Extremely slow, passive decision-making; absolute resistance to any change once a path is set.", value: 4 }
				]
			},
		],
	},
	{
		key: "lifestyle",
		title: "Lifestyle Indicators",
		questions: [
			{
				id: "l_v1",
				doshaType: "vata",
				text: "Activity Preference (Vata)",
				options: [
					{ label: "Prefer highly structured, calm, low-intensity, or repetitive physical movements.", value: 0 },
					{ label: "Enjoy moderate activity; standard workouts or sports.", value: 1 },
					{ label: "Enjoy active movement; get slightly restless with too much stillness.", value: 2 },
					{ label: "Prefer highly active, fast-paced, and varied/spontaneous workouts.", value: 3 },
					{ label: "Constantly on the move; crave change and feel intensely restless or bored with any repetitive routine or slow activity.", value: 4 }
				]
			},
			{
				id: "l_v2",
				doshaType: "vata",
				text: "Food Craving Style (Vata)",
				options: [
					{ label: "Prefer cold, bitter, dry, or light salads and raw foods.", value: 0 },
					{ label: "Enjoy standard warm meals; no intense texture cravings.", value: 1 },
					{ label: "Sometimes crave heavy comfort foods when feeling tired.", value: 2 },
					{ label: "Frequently crave warm, sweet, oily, or well-cooked warm dishes, especially when stressed.", value: 3 },
					{ label: "Strong, persistent cravings for warm, heavy, sweet, sour, and oily foods; dry/cold food makes me feel anxious or bloated.", value: 4 }
				]
			},
			{
				id: "l_v3",
				doshaType: "vata",
				text: "Daily Routine Pattern (Vata)",
				options: [
					{ label: "Extremely strict, clockwork schedule for sleeping and eating.", value: 0 },
					{ label: "Moderate consistency; sleep and meal times are generally stable.", value: 1 },
					{ label: "Occasional shifts in routine due to travel or work.", value: 2 },
					{ label: "Irregular daily schedule; meal times and sleeping hours fluctuate from day to day.", value: 3 },
					{ label: "Highly chaotic, unpredictable routine; eating and sleeping times vary constantly, and I struggle with fixed schedules.", value: 4 }
				]
			},
			{
				id: "l_p1",
				doshaType: "pitta",
				text: "Activity Preference (Pitta)",
				options: [
					{ label: "Dislike competition; prefer peaceful, low-effort, or slow workouts.", value: 0 },
					{ label: "Enjoy casual exercises and friendly, non-competitive games.", value: 1 },
					{ label: "Moderately competitive; enjoy goal-setting in workouts.", value: 2 },
					{ label: "Highly competitive, structured, and target-driven physical workouts or sports.", value: 3 },
					{ label: "Intense competitor; thrive on high-intensity, goal-oriented, or rival-based challenges; pushing to my limits is essential.", value: 4 }
				]
			},
			{
				id: "l_p2",
				doshaType: "pitta",
				text: "Food Craving Style (Pitta)",
				options: [
					{ label: "Prefer hot, spicy, sour, or highly salted foods.", value: 0 },
					{ label: "Normal tolerance; no specific flavor cravings.", value: 1 },
					{ label: "Occasionally crave cold desserts or refreshing drinks.", value: 2 },
					{ label: "Frequently crave cold drinks, ice creams, sweet fruits, and mild/cool foods to soothe body heat.", value: 3 },
					{ label: "Intense, urgent cravings for cold, sweet, bitter, and refreshing items; hot spicy food makes me feel instantly hot and irritable.", value: 4 }
				]
			},
			{
				id: "l_p3",
				doshaType: "pitta",
				text: "Daily Punctuality & Routine (Pitta)",
				options: [
					{ label: "Highly spontaneous; dislike schedules and run late frequently.", value: 0 },
					{ label: "Generally on time; flexible with schedules.", value: 1 },
					{ label: "Organized; stick to schedule most of the time.", value: 2 },
					{ label: "Disciplined and punctual; schedule meals and meetings with high precision.", value: 3 },
					{ label: "Obsessively structured and punctual; feel highly stressed or irritable if meals are delayed or if someone else is late.", value: 4 }
				]
			},
			{
				id: "l_k1",
				doshaType: "kapha",
				text: "Activity Motivation (Kapha)",
				options: [
					{ label: "Restless and hyperactive; find it impossible to stay still or relax.", value: 0 },
					{ label: "Keep an active lifestyle naturally; standard exercise routine.", value: 1 },
					{ label: "Enjoy calm workouts like walking; need a minor push to exercise.", value: 2 },
					{ label: "Highly prefer calm, sedentary, or slow movements; need strong external motivation to start exercising.", value: 3 },
					{ label: "Extremely sedentary; strong inertia; find it very difficult to start physical exercises and prefer complete rest or sitting.", value: 4 }
				]
			},
			{
				id: "l_k2",
				doshaType: "kapha",
				text: "Comfort Food Craving (Kapha)",
				options: [
					{ label: "Prefer light, bitter, or dry foods; avoid heavy, sweet things.", value: 0 },
					{ label: "Balanced diet; rarely seek emotional comfort foods.", value: 1 },
					{ label: "Sometimes crave sweets or carbohydrates when bored.", value: 2 },
					{ label: "Frequently crave sweet, heavy, dairy, or rich oily comfort foods when feeling emotional.", value: 3 },
					{ label: "Powerful, constant cravings for heavy, sweet, sticky, and dairy items (chocolates, cakes, cheeses); eat to seek comfort or emotional stability.", value: 4 }
				]
			},
			{
				id: "l_k3",
				doshaType: "kapha",
				text: "Daily Routine Adaptability (Kapha)",
				options: [
					{ label: "Constantly changing routines; hate doing the same thing twice.", value: 0 },
					{ label: "Flexible; adjust routines easily based on external factors.", value: 1 },
					{ label: "Prefer a steady routine but can adapt with minor discomfort.", value: 2 },
					{ label: "Deeply attached to a set routine; resist changes and prefer repeating the same structure.", value: 3 },
					{ label: "Complete resistance to change; stick strictly to the exact same daily structure for years; changing my routine causes deep mental stress.", value: 4 }
				]
			},
		],
	},
];

// Hoisted to module scope so these keep a stable component identity across
// re-renders -- see the identical fix/comment in AyurvedaDashboard.jsx for
// why defining these inside render was the root cause of the modal
// focus-loss bug.
function EmbeddedWrapper({ children }) {
	return <div className="flex flex-col gap-6">{children}</div>;
}
function PageWrapper({ children }) {
	return (
		<main className="bg-background">
			<div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">{children}</div>
		</main>
	);
}

function DoshaAssessmentQuiz({ embedded = false, onDone } = {}) {
	const { auth, loading: authLoading } = useContext(AuthContext);
	const navigate = useNavigate();
	const [step, setStep] = useState(0);
	const [answers, setAnswers] = useState({});
	const [result, setResult] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [loadingExisting, setLoadingExisting] = useState(!embedded);

	useEffect(() => {
		if (embedded) return;
		if (authLoading) return;
		if (!auth.token) {
			navigate("/signin");
			return;
		}
		(async () => {
			try {
				const res = await axios.get(`${API}/api/ayurveda/dosha-assessment`, {
					headers: { Authorization: `Bearer ${auth.token}` },
				});
				if (res.data?.isComplete) setResult(res.data);
			} catch (error) {
				console.error("Error fetching existing assessment:", error);
			} finally {
				setLoadingExisting(false);
			}
		})();
	}, [auth, authLoading, navigate, embedded]);

	const category = CATEGORIES[step];
	const isLastStep = step === CATEGORIES.length - 1;
	const currentAnswered = category?.questions.every((q) => answers[q.id] !== undefined);

	const handleAnswer = (questionId, value) => {
		setAnswers((a) => ({ ...a, [questionId]: value }));
	};

	const handleSubmit = async () => {
		setSubmitting(true);
		try {
			const responses = CATEGORIES.flatMap((cat) =>
				cat.questions.map((q) => ({
					questionId: q.id,
					category: cat.key,
					doshaType: q.doshaType,
					score: answers[q.id] ?? 0,
				}))
			);
			const res = await axios.post(
				`${API}/api/ayurveda/dosha-assessment`,
				{ responses },
				{ headers: { Authorization: `Bearer ${auth.token}` } }
			);
			setResult(res.data.assessment);
		} catch (error) {
			console.error("Error submitting assessment:", error);
			alert(error.response?.data?.error || "Failed to submit assessment.");
		} finally {
			setSubmitting(false);
		}
	};

	const Wrapper = embedded ? EmbeddedWrapper : PageWrapper;

	if (loadingExisting) {
		return <Wrapper><p className="text-center text-muted-foreground">Loading…</p></Wrapper>;
	}

	if (result) {
		return (
			<Wrapper>
				<div className="flex items-center justify-between gap-3">
					{!embedded ? <BackButton to="/ayurveda-wellness" /> : <div />}
					<Button variant="outline" size="sm" onClick={() => { setResult(null); setStep(0); setAnswers({}); }}>
						Retake assessment
					</Button>
				</div>
				<Card>
						<CardHeader>
							<CardTitle className="font-display text-xl">Your Prakriti assessment result</CardTitle>
							<CardDescription>This reflects your Ayurvedic body constitution.</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<div className="flex flex-wrap gap-6 text-sm">
								<div>
									<p className="text-muted-foreground">Primary Dosha</p>
									<p className="font-display text-lg text-foreground">{result.primaryDosha}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Secondary Dosha</p>
									<p className="font-display text-lg text-foreground">{result.secondaryDosha || "None"}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Third dosha status</p>
									<p className="font-display text-lg text-foreground">{result.thirdDoshaStatus}</p>
								</div>
							</div>
							{result.doshaProfile?.primary ? (
								<div className="flex flex-col gap-4 rounded-(--jh-radius-md) bg-secondary/60 p-4 text-sm">
									<div>
										<p className="font-display text-base text-foreground">
											{result.doshaProfile.primary.title}
											{result.doshaProfile.secondary ? ` – ${result.doshaProfile.secondary.title}` : ""} constitution
										</p>
										<p className="mt-1 text-muted-foreground">{result.doshaProfile.primary.explanation}</p>
									</div>
									<div>
										<p className="font-medium text-foreground">Your characteristics</p>
										<ul className="mt-1 list-disc pl-5 text-muted-foreground">
											{result.doshaProfile.primary.characteristics.map((c, i) => <li key={i}>{c}</li>)}
										</ul>
									</div>
									<div>
										<p className="font-medium text-foreground">Possible imbalance areas</p>
										<ul className="mt-1 list-disc pl-5 text-muted-foreground">
											{result.doshaProfile.primary.possibleImbalances.map((c, i) => <li key={i}>{c}</li>)}
										</ul>
									</div>
									<div>
										<p className="font-medium text-foreground">Lifestyle recommendations</p>
										<ul className="mt-1 list-disc pl-5 text-muted-foreground">
											{result.doshaProfile.primary.lifestyleRecommendations.map((c, i) => <li key={i}>{c}</li>)}
										</ul>
									</div>
								</div>
							) : null}

							<div className="flex gap-2">
								<Button onClick={() => (embedded ? onDone?.() : navigate("/ayurveda-wellness"))}>
									{embedded ? "Done" : "Continue to dashboard"}
								</Button>
								<Button variant="outline" onClick={() => { setResult(null); setStep(0); setAnswers({}); }}>
									Retake assessment
								</Button>
							</div>
						</CardContent>
					</Card>
			</Wrapper>
		);
	}

	return (
		<Wrapper>
			{!embedded ? <BackButton to="/ayurveda-wellness" /> : null}
			<div>
				<h1 className="font-display text-2xl text-foreground">Prakriti (Dosha) assessment</h1>
				<p className="text-sm text-muted-foreground">
					Step {step + 1} of {CATEGORIES.length}: {category.title}
				</p>
				</div>

				<Card>
					<CardContent className="flex flex-col gap-6 pt-6">
						{category.questions.map((q, qIdx) => (
							<div key={q.id} className="flex flex-col gap-2">
								<p className="text-sm font-semibold text-[#2e4a31]">Q{qIdx + 1}. {q.text}</p>
								<div className="flex flex-col gap-3 pl-1 mt-1">
									{(q.options || OPTIONS).map((opt) => (
										<button
											key={opt.value}
											type="button"
											onClick={() => handleAnswer(q.id, opt.value)}
											className="flex items-start gap-3 w-full text-left px-2 py-1.5 rounded-lg hover:bg-primary/5 text-sm transition-all group cursor-pointer"
										>
											<div className={cn(
												"w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
												answers[q.id] === opt.value
													? "border-[#2e4a31] bg-transparent"
													: "border-muted-foreground/40 bg-transparent group-hover:border-foreground/60"
											)}>
												{answers[q.id] === opt.value && (
													<div className="w-2 h-2 rounded-full bg-[#2e4a31]" />
												)}
											</div>
											<span className="text-foreground/80 font-medium text-sm leading-snug group-hover:text-foreground">
												{opt.label}
											</span>
										</button>
									))}
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<div className="flex justify-between">
					<Button
						variant="outline"
						onClick={() => setStep((s) => Math.max(0, s - 1))}
						disabled={step === 0}
					>
						<ArrowLeft size={16} /> Back
					</Button>
					{isLastStep ? (
						<Button onClick={handleSubmit} disabled={!currentAnswered || submitting}>
							{submitting ? "Submitting…" : "Submit assessment"}
						</Button>
					) : (
						<Button onClick={() => setStep((s) => s + 1)} disabled={!currentAnswered}>
							Continue <ArrowRight size={16} />
						</Button>
					)}
				</div>
		</Wrapper>
	);
}

export default DoshaAssessmentQuiz;
