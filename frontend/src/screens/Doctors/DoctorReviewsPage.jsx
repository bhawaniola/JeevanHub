import { useEffect, useState } from "react";
import { Star } from "lucide-react";

import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";

const DoctorReviewsPage = () => {
	const [reviews, setReviews] = useState([]);
	const doctorEmail = localStorage.getItem("email");

	useEffect(() => {
		const fetchReviews = async () => {
			const res = await fetch(`${BACKEND_URL}/api/bookings/reviews/${doctorEmail}`);
			const data = await res.json();
			setReviews(data);
		};
		fetchReviews();
	}, [doctorEmail]);

	return (
		<DashboardShell>
			<DashboardPageHeader title="My Reviews" />

			<div className="mx-auto max-w-3xl">
				{reviews.length > 0 ? (
					<div className="flex flex-col gap-4">
						{reviews.map((r, i) => (
							<Card key={i} className="p-5">
								<h3 className="text-lg font-semibold text-foreground">{r.patientName}</h3>
								<p className="mt-1 flex items-center gap-1 text-sm font-medium text-primary">
									<Star className="size-4 fill-primary text-primary" /> Rating: {r.rating}
								</p>
								<p className="mt-2 text-sm italic text-foreground/80">{r.review}</p>
								<p className="mt-2 text-xs text-muted-foreground">
									Date: {formatDate(r.dateOfAppointment)}
								</p>
							</Card>
						))}
					</div>
				) : (
					<p className="text-center text-muted-foreground">No reviews yet.</p>
				)}
			</div>
		</DashboardShell>
	);
};

export default DoctorReviewsPage;
