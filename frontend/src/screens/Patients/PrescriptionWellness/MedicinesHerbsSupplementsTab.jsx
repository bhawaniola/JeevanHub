import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pill } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date";
import { AuthContext } from "../../../context/AuthContext";
import { BACKEND_URL } from "../../../config";
import { authFetch } from "../../../utils/authFetch";

const API = BACKEND_URL || "http://localhost:8080";

// Medicines have no AI path -- everything here is doctor-entered, so the
// empty-vs-missing distinction is: [] means the doctor hasn't prescribed
// anything yet ("Not prescribed"), while a failed fetch is a different,
// explicit error state (never silently reused as "Not prescribed").
function MedicinesHerbsSupplementsTab() {
	const { auth } = useContext(AuthContext);
	const patientId = auth?.user?.id;

	const [bookings, setBookings] = useState(null);
	const [availability, setAvailability] = useState({}); // medicineId -> boolean
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);

	useEffect(() => {
		if (!patientId) {
			setLoading(false);
			return;
		}
		(async () => {
			setLoading(true);
			setLoadFailed(false);
			try {
				const res = await authFetch(`${API}/api/bookings/patient/${patientId}`);
				if (!res.ok) throw new Error("Failed to load prescribed medicines");
				const data = await res.json();
				const loadedBookings = data.bookings || [];
				setBookings(loadedBookings);

				// Check each prescribed medicine still exists (and is active) in the
				// store, so we can link to it or say "Not available" instead of
				// pointing at a dead/removed listing.
				const ids = [...new Set(
					loadedBookings.flatMap((b) => (b.recommendedSupplements || []).map((s) => s.medicineId).filter(Boolean))
				)];
				const results = await Promise.allSettled(
					ids.map((id) => fetch(`${API}/api/medicines/${id}`).then((r) => (r.ok ? r.json() : null)))
				);
				const map = {};
				ids.forEach((id, i) => {
					const outcome = results[i];
					const medicine = outcome.status === "fulfilled" ? outcome.value : null;
					map[id] = Boolean(medicine && medicine.isActive !== false);
				});
				setAvailability(map);
			} catch (error) {
				console.error("Error fetching medicines:", error);
				setLoadFailed(true);
			} finally {
				setLoading(false);
			}
		})();
	}, [patientId]);

	if (loading) {
		return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
	}

	if (loadFailed) {
		return (
			<EmptyState
				icon={Pill}
				title="Unable to load"
				description="We couldn't load your prescribed medicines right now. Please try again shortly."
			/>
		);
	}

	// Doctor may still be working on a draft (published: false) -- the patient
	// only sees a medicine once the doctor submits the prescription.
	const rows = (bookings || []).flatMap((booking) => {
		const rawDocName =
			booking.doctorName ||
			(booking.doctorId?.firstName
				? `${booking.doctorId.firstName} ${booking.doctorId.lastName || ""}`.trim()
				: "");
		const cleanDocName = rawDocName
			? (/^dr\.?\s+/i.test(rawDocName.trim()) ? rawDocName.trim() : `Dr. ${rawDocName.trim()}`)
			: "";

		return (booking.recommendedSupplements || [])
			.filter((supp) => supp.published !== false)
			.map((supp) => ({
				...supp,
				doctorName: cleanDocName,
				addedAt: supp.addedAt,
			}));
	});

	if (rows.length === 0) {
		return (
			<EmptyState
				icon={Pill}
				title="Not prescribed"
				description="Your doctor hasn't prescribed any medicines, herbs, or supplements yet."
			/>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2 font-display text-lg">
						<Pill size={18} /> Medicines, Herbs & Supplements
					</CardTitle>
					<SourceBadge status="doctor" />
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{rows.map((row, i) => {
					const isAvailable = row.medicineId && availability[row.medicineId];
					const Wrapper = isAvailable ? Link : "div";
					const wrapperProps = isAvailable ? { to: `/medicines/${row.medicineId}` } : {};
					return (
						<Wrapper
							key={row._id || i}
							{...wrapperProps}
							className={cn(
								"group flex flex-col gap-2 rounded-(--jh-radius-sm) border border-border p-4 transition-colors",
								isAvailable && "hover:border-primary hover:bg-primary/5",
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-sm font-semibold text-foreground">
										<span className="font-medium text-muted-foreground">Medicine Name: </span>
										{row.medicineName}
									</span>
									{!isAvailable ? <Badge variant="destructive">Not available</Badge> : null}
								</div>
								{isAvailable ? (
									<ChevronRight size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
								) : null}
							</div>

							{row.dosage ? (
								<p className="text-sm text-foreground/90">
									<span className="font-medium text-muted-foreground">Dosage: </span>
									{row.dosage}
								</p>
							) : null}

							{row.instructions ? (
								<p className="text-sm text-foreground/90">
									<span className="font-medium text-muted-foreground">Instructions: </span>
									{row.instructions}
								</p>
							) : null}

							<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
								<span>
									<strong className="font-medium text-foreground">Doctor Name: </strong>
									{row.doctorName || "Your Doctor"}
								</span>
								{row.addedAt ? (
									<span>
										<strong className="font-medium text-foreground">Prescription Date: </strong>
										{formatDate(row.addedAt)}
									</span>
								) : null}
							</div>
						</Wrapper>
					);
				})}
			</CardContent>
		</Card>
	);
}

export default MedicinesHerbsSupplementsTab;
