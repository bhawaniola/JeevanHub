import React from "react";
import { Pill } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/date";

const Prescription = ({ patientBookings }) => {
	const supplementCount = patientBookings.reduce(
		(total, booking) => total + (booking.recommendedSupplements?.length || 0),
		0
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-display text-xl">
					<Pill size={20} /> Medicines, Herbs & Supplements
					<Badge variant="secondary">{supplementCount}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{supplementCount > 0 ? (
					patientBookings.map((booking, bIdx) =>
						booking.recommendedSupplements.map((supp, sIdx) => {
							const rawDoctor = booking.doctorName || "Doctor";
							const doctorLabel = rawDoctor.startsWith("Dr.") ? rawDoctor : `Dr. ${rawDoctor}`;

							return (
								<div
									key={`${bIdx}-${sIdx}`}
									className="flex flex-col gap-2.5 rounded-(--jh-radius-md) border border-border bg-card p-4.5 transition-colors hover:border-(--jh-olive-leaf)/40 shadow-xs"
								>
									<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
										<div>
											<span className="text-xs font-medium text-muted-foreground">Medicine Name: </span>
											<span className="text-base font-bold text-foreground">{supp.medicineName}</span>
										</div>
									</div>

									<p className="text-sm text-foreground/90">
										<span className="font-medium text-muted-foreground">Dosage: </span>
										<span>{supp.dosage || <span className="italic text-muted-foreground">Not provided</span>}</span>
									</p>

									<p className="text-sm text-foreground/90">
										<span className="font-medium text-muted-foreground">Instructions: </span>
										<span className="italic">{supp.instructions || <span className="not-italic text-muted-foreground">Not provided</span>}</span>
									</p>

									{supp.forIllness ? (
										<p className="text-sm text-foreground/90">
											<span className="font-medium text-muted-foreground">For: </span>
											<span>{supp.forIllness}</span>
										</p>
									) : null}

									{supp.duration ? (
										<p className="text-sm text-foreground/90">
											<span className="font-medium text-muted-foreground">Duration: </span>
											<span>{supp.duration}</span>
										</p>
									) : null}

									<div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
										<span>
											<strong className="text-foreground/80">Doctor Name:</strong>{" "}
											{doctorLabel}
										</span>
										<span>
											<strong className="text-foreground/80">Prescription Date:</strong>{" "}
											{formatDate(booking.createdAt || booking.dateOfAppointment)}
										</span>
									</div>
								</div>
							);
						})
					)
				) : (
					<EmptyState icon={Pill} title="Not prescribed" description="Prescribed medicines, herbs, and supplements will show up here once a doctor adds them." />
				)}
			</CardContent>
		</Card>
	);
};

export default Prescription;
