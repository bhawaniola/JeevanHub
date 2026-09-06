import { useState, useEffect } from "react";
import { ClipboardPlus, Plus, Trash2, Loader2, ShoppingCart, Pill } from "lucide-react";

import { MedicinePickerModal } from "./MedicinePickerModal";
import { authFetch } from "../../../utils/authFetch";
import { BACKEND_URL } from "../../../config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SourceBadge } from "@/components/ui/SourceBadge";

const BACKEND = BACKEND_URL || "http://localhost:8080";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=300&auto=format&fit=crop";

const resolveThumb = (images) => {
	const imgs = (images || []).filter(Boolean).map((img) => (img.startsWith("http") ? img : `${BACKEND}/${img}`));
	return imgs.length ? imgs[0] : FALLBACK_IMAGE;
};

export function MedicineForm({ bookingId, patientId, doctorId, onPrescribed }) {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		let active = true;
		const load = async () => {
			try {
				const suppRes = await authFetch(`${BACKEND}/api/bookings/supplements/${bookingId}`);
				const suppData = suppRes.ok ? await suppRes.json() : { supplements: [] };
				const supps = (suppData.supplements || []).map((s) => {
					const med = s.medicineId;
					const isObj = typeof med === "object" && med !== null;
					return {
						_id: s._id,
						medicineId: isObj ? med._id : med,
						medicineName: s.medicineName,
						dosage: s.dosage || "",
						instructions: s.instructions || "",
						published: s.published,
						thumb: isObj && med.images ? resolveThumb(med.images) : FALLBACK_IMAGE,
						price: isObj && med.price !== undefined ? med.price : undefined,
					};
				});
				if (active) setRows(supps);
			} catch (e) {
				console.error("Error loading prescribed medicines:", e);
			} finally {
				if (active) setLoading(false);
			}
		};
		load();
		return () => {
			active = false;
		};
	}, [bookingId]);

	const handleSelectMedicine = async (medicine) => {
		setAdding(true);
		try {
			const res = await authFetch(`${BACKEND}/api/bookings/${bookingId}/supplements`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ medicineId: medicine._id }),
			});
			if (!res.ok) {
				const e = await res.json().catch(() => ({}));
				throw new Error(e.error || "Failed to add medicine");
			}
			const data = await res.json();
			const s = data.supplement;
			setRows((prev) => [
				...prev,
				{
					_id: s._id,
					medicineId: s.medicineId,
					medicineName: s.medicineName,
					dosage: "",
					instructions: "",
					published: s.published,
					thumb: resolveThumb(medicine.images),
					price: medicine.price,
				},
			]);
			onPrescribed?.();
		} catch (e) {
			alert(`Error: ${e.message}`);
		} finally {
			setAdding(false);
		}
	};

	const updateRowLocal = (id, field, value) => {
		setRows((prev) => prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)));
	};

	const saveRow = async (row) => {
		try {
			await authFetch(`${BACKEND}/api/bookings/${bookingId}/supplements/${row._id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dosage: row.dosage, instructions: row.instructions }),
			});
		} catch (e) {
			console.error("Failed to save row:", e);
		}
	};

	const deleteRow = async (id) => {
		const snapshot = rows;
		setRows((prev) => prev.filter((r) => r._id !== id));
		try {
			const res = await authFetch(`${BACKEND}/api/bookings/${bookingId}/supplements/${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error();
			onPrescribed?.();
		} catch (e) {
			setRows(snapshot);
			alert("Failed to remove medicine. Please try again.");
		}
	};

	return (
		<Card className="overflow-hidden p-0">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-6 py-4">
				<h3 className="flex items-center gap-3 text-lg font-bold text-foreground">
					<ClipboardPlus className="size-6 text-primary" />
					Medicines, Herbs & Supplements
				</h3>
				<div className="flex items-center gap-3">
					{rows.length > 0 ? <SourceBadge status="doctor" /> : null}
					<span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
						<ShoppingCart size={14} /> Prescribed items are added to the patient's cart
					</span>
				</div>
			</div>

			<div className="p-6">
				{loading ? (
					<p className="flex items-center justify-center gap-2.5 py-6 text-muted-foreground">
						<Loader2 className="size-[18px] animate-spin" /> Loading prescription...
					</p>
				) : (
					<>
						{rows.length === 0 ? (
							<div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
								<Pill size={32} />
								<p className="mt-1.5 font-semibold text-muted-foreground/90">Not prescribed</p>
								<span className="text-sm">Click "Add Medicine" to pick from the store inventory.</span>
							</div>
						) : (
							<div className="mb-5 flex max-h-[420px] flex-col gap-2 overflow-y-auto">
								<div className="hidden grid-cols-[1.5fr_1.7fr_1.7fr_40px] gap-3 border-b-2 border-border px-1 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wide sm:grid">
									<div>Medicine</div>
									<div>Dosage</div>
									<div>Instructions</div>
									<div />
								</div>

								{rows.map((row) => (
									<div
										key={row._id}
										className="relative grid grid-cols-1 items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1.5fr_1.7fr_1.7fr_40px]"
									>
										<div className="flex items-center gap-2.5 pr-12 sm:pr-0">
											<img
												src={row.thumb}
												alt={row.medicineName}
												className="size-9 shrink-0 rounded-md border border-border bg-card object-cover"
												onError={(e) => {
													e.currentTarget.onerror = null;
													e.currentTarget.src = FALLBACK_IMAGE;
												}}
											/>
											<div className="flex min-w-0 flex-col gap-0.5">
												<span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-foreground">
													{row.medicineName}
													{row.published === false ? (
														<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Draft -- not sent yet</span>
													) : null}
												</span>
												{row.price != null ? <span className="text-sm font-semibold text-primary">₹{row.price}</span> : null}
											</div>
										</div>

										<div>
											<label className="mb-1 block text-[11px] font-bold text-muted-foreground uppercase sm:hidden">Dosage</label>
											<Textarea
												rows={2}
												className="min-h-[52px] text-xs"
												placeholder="e.g., Start tomorrow · one tablet · twice daily for 20 days"
												value={row.dosage}
												onChange={(e) => updateRowLocal(row._id, "dosage", e.target.value)}
												onBlur={() => saveRow(row)}
											/>
										</div>

										<div>
											<label className="mb-1 block text-[11px] font-bold text-muted-foreground uppercase sm:hidden">
												Instructions
											</label>
											<Textarea
												rows={2}
												className="min-h-[52px] text-xs"
												placeholder="e.g., Take after meals with warm water"
												value={row.instructions}
												onChange={(e) => updateRowLocal(row._id, "instructions", e.target.value)}
												onBlur={() => saveRow(row)}
											/>
										</div>

										<div className="absolute top-3.5 right-3.5 flex items-center justify-center sm:static">
											<Button
												variant="outline"
												size="icon"
												className="size-8 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
												onClick={() => deleteRow(row._id)}
												title="Remove medicine"
											>
												<Trash2 size={16} />
											</Button>
										</div>
									</div>
								))}
							</div>
						)}

						<Button
							variant="outline"
							className="w-full border-dashed"
							onClick={() => setPickerOpen(true)}
							disabled={adding}
						>
							{adding ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
							Add Medicine
						</Button>
					</>
				)}
			</div>

			{pickerOpen ? <MedicinePickerModal onSelect={handleSelectMedicine} onClose={() => setPickerOpen(false)} /> : null}
		</Card>
	);
}
