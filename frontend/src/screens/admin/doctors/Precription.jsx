import { useState, useEffect } from "react";
import { Pill, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import { authFetch } from "../../../utils/authFetch";
import { BACKEND_URL } from "../../../config";

const DoctorPrescriptions = ({ doctorId }) => {
	const [doctorBookings, setDoctorBookings] = useState([]);
	const [loadingBookings, setLoadingBookings] = useState(true);

	useEffect(() => {
		const fetchDoctorBookings = async () => {
			try {
				const token = localStorage.getItem("token");
				const res = await authFetch(`${BACKEND_URL}/api/bookings/doctor/${doctorId}`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!res.ok) {
					if (res.status === 404) {
						setDoctorBookings([]);
						return;
					}
					throw new Error("Failed to fetch doctor bookings");
				}

				const data = await res.json();
				setDoctorBookings(data.bookings);
			} catch (error) {
				console.error("Error fetching doctor bookings:", error);
			} finally {
				setLoadingBookings(false);
			}
		};

		if (doctorId) fetchDoctorBookings();
	}, [doctorId]);

	return (
		<Card className="p-6">
			<h3 className="flex items-center gap-2 border-b border-border pb-4 text-xl font-semibold text-foreground">
				<Pill className="size-5" /> Medicines, Herbs & Supplements
			</h3>

			<div className="mt-5 flex flex-col gap-4">
				{loadingBookings ? (
					<p className="text-sm text-muted-foreground">Loading prescriptions...</p>
				) : doctorBookings.length > 0 ? (
					doctorBookings.map((booking) =>
						booking.recommendedSupplements?.length > 0 ? (
							booking.recommendedSupplements.map((s, idx) => (
								<div key={s._id || idx} className="rounded-lg border border-border bg-muted/40 p-5">
									<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
										<h4 className="text-base font-semibold text-foreground">{s.medicineName}</h4>
										<span className="text-sm font-medium text-primary">{s.dosage}</span>
									</div>
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
										<div>
											<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
												Duration
											</p>
											<p className="text-sm text-foreground/80">{s.duration}</p>
										</div>
										<div>
											<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
												Instructions
											</p>
											<p className="text-sm text-foreground/80">{s.instructions}</p>
										</div>
										<div>
											<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
												For Illness
											</p>
											<p className="text-sm text-foreground/80">{s.forIllness}</p>
										</div>
										<div>
											<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
												Patient Name
											</p>
											<p className="text-sm text-foreground/80">{booking.patientName}</p>
										</div>
									</div>
									<p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
										<Clock className="size-3.5" /> Prescribed on {formatDate(booking.createdAt)}
									</p>
								</div>
							))
						) : (
							<p key={booking._id} className="py-4 text-center text-sm italic text-muted-foreground">
								Not prescribed for {booking.patientName}.
							</p>
						)
					)
				) : (
					<p className="py-8 text-center text-muted-foreground">
						Not prescribed for any of this doctor's patients yet.
					</p>
				)}
			</div>
		</Card>
	);
};

export default DoctorPrescriptions;
