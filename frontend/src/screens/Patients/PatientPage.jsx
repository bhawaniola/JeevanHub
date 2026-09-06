import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ArrowRight, Leaf, Sparkles } from "lucide-react";

import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";
import { authFetch } from "../../utils/authFetch";

import appointmentImage from "../../media/appoint3.jpg";
import doctorImage from "../../media/appoint1.jpg";
import treatmentImage from "../../media/tre-plan.jpg";
import medicineImage from "../../media/capsule.jpg";
import yogaImage from "../../media/yoga-diet.jpg";

function ServiceCard({ image, title, description, to, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group relative flex flex-col overflow-hidden rounded-(--jh-radius-lg) border border-border/80 bg-card text-left shadow-(--jh-shadow-rest) transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-(--jh-olive-leaf)/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 transform-gpu cursor-pointer"
		>
			<div className="h-32 w-full overflow-hidden bg-secondary/30">
				<img
					src={image}
					alt=""
					className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 transform-gpu"
				/>
			</div>
			<div className="flex flex-1 flex-col gap-1 p-4">
				<h3 className="font-display text-lg leading-tight text-foreground transition-colors duration-200 group-hover:text-(--jh-olive-leaf)">
					{title}
				</h3>
				<p className="text-sm leading-snug text-muted-foreground">{description}</p>
			</div>
		</button>
	);
}

function PatientPage() {
	const { auth } = useContext(AuthContext);
	const firstName = auth.user?.firstName || "there";
	const navigate = useNavigate();
	const [isPrakritiFilled, setIsPrakritiFilled] = useState(false);
	const [userId, setUserId] = useState(null);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				setUserId(jwtDecode(token).id);
			} catch (error) {
				console.error("Invalid token:", error);
			}
		}
	}, []);

	useEffect(() => {
		const token = localStorage.getItem("token");
		const fetchPrakritiData = async () => {
			try {
				const response = await authFetch(`${BACKEND_URL}/api/ayurveda/dosha-assessment`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = response.ok ? await response.json() : null;
				setIsPrakritiFilled(Boolean(data?.isComplete));
			} catch (error) {
				console.error("Error fetching Prakriti assessment data:", error);
				setIsPrakritiFilled(false);
			}
		};

		if (auth.user?.email) fetchPrakritiData();
	}, [auth.user?.email]);

	const services = [
		{
			title: "Your profile",
			description: "View and update your details.",
			image: doctorImage,
			onClick: () => navigate(`/profile/patient/${userId}`),
		},
		{
			title: "Appointments",
			description: "See your currently assigned Ayurvedic doctor.",
			image: appointmentImage,
			onClick: () => navigate("/appointed-doctor"),
		},
		{
			title: "Treatment plans",
			description: "Explore personalized Ayurvedic treatment plans.",
			image: treatmentImage,
			onClick: () => navigate("/treatments"),
		},
		{
			title: "Prescription & Wellness",
			description: "Medicines, meal plan, yoga, and wellness recommendations.",
			image: yogaImage,
			onClick: () => navigate("/prescription-wellness"),
		},
		{
			title: "Medicines & remedies",
			description: "Browse Ayurvedic medicines and natural remedies.",
			image: medicineImage,
			onClick: () => navigate("/medicines"),
		},
	];

	return (
		<DashboardShell>
			<DashboardPageHeader
				title={`Hi ${firstName},`}
				description="Welcome back to your Ayurvedic wellness journey. We're here to help you find balance, one step at a time."
			/>

			<section
					className={cn(
						"mt-8 flex flex-col items-start gap-4 rounded-(--jh-radius-lg) bg-card p-6 shadow-(--jh-shadow-card) sm:flex-row sm:items-center sm:justify-between",
					)}
				>
					<div className="flex items-start gap-3">
						<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
							{isPrakritiFilled ? <Sparkles className="size-5" aria-hidden="true" /> : <Leaf className="size-5" aria-hidden="true" />}
						</span>
						<div>
							<p className="font-display text-lg text-foreground">
								{isPrakritiFilled ? "Thank you for completing your Prakriti assessment." : "Complete your Prakriti Determination"}
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{isPrakritiFilled
									? "See your result, or share it with your doctor for a more precise plan."
									: "A short questionnaire that helps us match you with the most suitable doctor."}
							</p>
						</div>
					</div>
					<Button
						onClick={() =>
							isPrakritiFilled
								? navigate("/ayurveda-wellness")
								: navigate("/ayurveda-wellness/assessment")
						}
						className="w-full shrink-0 sm:w-auto"
					>
						{isPrakritiFilled ? "View your result" : "Start assessment"}
						<ArrowRight className="size-4" aria-hidden="true" />
					</Button>
				</section>

				<section className="mt-10">
					<h2 className="font-display text-2xl text-foreground">What can we help you with today?</h2>
					<div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
						{services.map((service) => (
							<ServiceCard key={service.title} {...service} />
						))}
				</div>
			</section>
		</DashboardShell>
	);
}

export default PatientPage;
