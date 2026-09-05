import React from "react";
import { Pill } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/date";
import { FieldStat } from "./shared";

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
						booking.recommendedSupplements.map((supp, sIdx) => (
							<div key={`${bIdx}-${sIdx}`} className="rounded-(--jh-radius-sm) border border-border p-4">
								<div className="mb-3 flex items-center justify-between">
									<h4 className="font-semibold text-foreground">{supp.medicineName}</h4>
									<span className="text-sm text-muted-foreground">{supp.dosage}</span>
								</div>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
									<FieldStat label="For" value={supp.forIllness} />
									<FieldStat label="Duration" value={supp.duration} />
									<FieldStat label="Instruction" value={supp.instructions} />
									<FieldStat label="Prescribed by" value={booking.doctorName} />
								</div>

								<p className="mt-4 text-xs text-muted-foreground">
									Prescribed on {formatDate(booking.createdAt)}
								</p>
							</div>
						))
					)
				) : (
					<EmptyState icon={Pill} title="Not prescribed" description="Prescribed medicines, herbs, and supplements will show up here once a doctor adds them." />
				)}
			</CardContent>
		</Card>
	);
};

export default Prescription;
