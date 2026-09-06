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
								<div key={s._id || idx} className="flex flex-col gap-2.5 rounded-(--jh-radius-md) border border-border bg-card p-4.5 transition-colors hover:border-(--jh-olive-leaf)/40 shadow-xs">
									<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
										<div>
											<span className="text-xs font-medium text-muted-foreground">Medicine Name: </span>
											<span className="text-base font-bold text-foreground">{s.medicineName}</span>
										</div>
									</div>

									<p className="text-sm text-foreground/90">
										<span className="font-medium text-muted-foreground">Dosage: </span>
										<span>{s.dosage || <span className="italic text-muted-foreground">Not provided</span>}</span>
									</p>

									<p className="text-sm text-foreground/90">
										<span className="font-medium text-muted-foreground">Instructions: </span>
										<span className="italic">{s.instructions || <span className="not-italic text-muted-foreground">Not provided</span>}</span>
									</p>

									{s.forIllness ? (
										<p className="text-sm text-foreground/90">
											<span className="font-medium text-muted-foreground">For: </span>
											<span>{s.forIllness}</span>
										</p>
									) : null}

									{s.duration ? (
										<p className="text-sm text-foreground/90">
											<span className="font-medium text-muted-foreground">Duration: </span>
											<span>{s.duration}</span>
										</p>
									) : null}

									<div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
										<span>
											<strong className="text-foreground/80">Patient Name:</strong>{" "}
											{booking.patientName}
										</span>
										<span>
											<strong className="text-foreground/80">Prescription Date:</strong>{" "}
											{formatDate(booking.createdAt || booking.dateOfAppointment)}
										</span>
									</div>
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
