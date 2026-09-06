import { useState, useEffect, useMemo } from "react";
import { Search, X, ChevronLeft, ChevronRight, ArrowLeft, Check, Loader2, Pill, Filter } from "lucide-react";

import { BACKEND_URL } from "../../../config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BACKEND = BACKEND_URL || "http://localhost:8080";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=600&auto=format&fit=crop";

const resolveImages = (medicine) => {
	const imgs = (medicine.images || []).filter(Boolean).map((img) => (img.startsWith("http") ? img : `${BACKEND}/${img}`));
	return imgs.length > 0 ? imgs : [FALLBACK_IMAGE];
};

// Full-screen medicine browser the doctor uses to pick an inventory item to prescribe.
export function MedicinePickerModal({ onSelect, onClose }) {
	const [medicines, setMedicines] = useState([]);
	const [categories, setCategories] = useState(["All"]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("All");

	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCount, setTotalCount] = useState(0);

	const [detailMedicine, setDetailMedicine] = useState(null);
	const [imageIndex, setImageIndex] = useState(0);

	// 1. Fetch categories list once (extremely lightweight, ~1KB)
	useEffect(() => {
		const fetchCategories = async () => {
			try {
				const res = await fetch(`${BACKEND}/api/medicines/categories`);
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data) && data.length > 0) {
						setCategories(["All", ...data]);
					}
				}
			} catch (e) {
				console.error("Error fetching medicine categories:", e);
			}
		};
		fetchCategories();
	}, []);

	// 2. Debounce search input by 250ms
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchTerm);
		}, 250);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	// 3. Fetch paginated medicines on search or category filter change
	useEffect(() => {
		let active = true;
		const fetchMedicines = async () => {
			setLoading(true);
			setError(null);
			setPage(1);
			try {
				const params = new URLSearchParams();
				params.append("limit", "24");
				params.append("page", "1");
				if (debouncedSearch.trim()) {
					params.append("search", debouncedSearch.trim());
				}
				if (selectedCategory && selectedCategory !== "All") {
					params.append("category", selectedCategory);
				}

				const res = await fetch(`${BACKEND}/api/medicines?${params.toString()}`);
				if (!res.ok) throw new Error("Failed to load medicines");
				const data = await res.json();
				if (!active) return;

				const list = Array.isArray(data) ? data : data.medicines || [];
				const total = Array.isArray(data) ? data.length : data.total ?? list.length;
				const pages = Array.isArray(data) ? 1 : data.totalPages ?? 1;

				setMedicines(list);
				setTotalCount(total);
				setTotalPages(pages);
			} catch (err) {
				if (active) setError(err.message);
			} finally {
				if (active) setLoading(false);
			}
		};

		fetchMedicines();
		return () => {
			active = false;
		};
	}, [debouncedSearch, selectedCategory]);

	// 4. Load more items (infinite pagination)
	const handleLoadMore = async () => {
		if (loadingMore || page >= totalPages) return;
		setLoadingMore(true);
		try {
			const nextPage = page + 1;
			const params = new URLSearchParams();
			params.append("limit", "24");
			params.append("page", String(nextPage));
			if (debouncedSearch.trim()) {
				params.append("search", debouncedSearch.trim());
			}
			if (selectedCategory && selectedCategory !== "All") {
				params.append("category", selectedCategory);
			}

			const res = await fetch(`${BACKEND}/api/medicines?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to load more medicines");
			const data = await res.json();
			const list = Array.isArray(data) ? data : data.medicines || [];

			setMedicines((prev) => [...prev, ...list]);
			setPage(nextPage);
		} catch (err) {
			console.error("Error loading more medicines:", err);
		} finally {
			setLoadingMore(false);
		}
	};

	const openDetail = (medicine) => {
		setDetailMedicine(medicine);
		setImageIndex(0);
	};

	const confirmSelect = (medicine) => {
		onSelect(medicine);
		onClose();
	};

	const detailImages = detailMedicine ? resolveImages(detailMedicine) : [];

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex h-[90vh] max-h-[850px] w-full max-w-[1100px] flex-col gap-0 p-0 overflow-hidden">
				<DialogHeader className="flex-row items-center justify-between border-b border-border bg-card px-6 py-4">
					{detailMedicine ? (
						<button
							className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline cursor-pointer"
							onClick={() => setDetailMedicine(null)}
						>
							<ArrowLeft size={18} /> Back to all medicines
						</button>
					) : (
						<div className="flex items-center justify-between w-full pr-6">
							<DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
								<Pill className="size-5 text-primary" /> Select a Medicine from Inventory
							</DialogTitle>
							<Badge variant="secondary" className="text-xs font-semibold">
								{totalCount} {totalCount === 1 ? "medicine" : "medicines"} available
							</Badge>
						</div>
					)}
				</DialogHeader>

				{detailMedicine ? (
					<div className="grid flex-1 grid-cols-1 gap-8 overflow-y-auto p-6 sm:grid-cols-2">
						<div>
							<div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 p-4">
								{detailImages.length > 1 ? (
									<button
										className="absolute top-1/2 left-2.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-xs hover:bg-card"
										onClick={() => setImageIndex((i) => (i === 0 ? detailImages.length - 1 : i - 1))}
									>
										<ChevronLeft size={20} />
									</button>
								) : null}
								<img
									src={detailImages[imageIndex]}
									alt={detailMedicine.name}
									className="size-full object-contain"
									onError={(e) => {
										e.currentTarget.onerror = null;
										e.currentTarget.src = FALLBACK_IMAGE;
									}}
								/>
								{detailImages.length > 1 ? (
									<button
										className="absolute top-1/2 right-2.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-xs hover:bg-card"
										onClick={() => setImageIndex((i) => (i === detailImages.length - 1 ? 0 : i + 1))}
									>
										<ChevronRight size={20} />
									</button>
								) : null}
							</div>
							{detailImages.length > 1 ? (
								<div className="mt-3 flex justify-center gap-1.5">
									{detailImages.map((_, idx) => (
										<span
											key={idx}
											onClick={() => setImageIndex(idx)}
											className={
												idx === imageIndex
													? "size-2.5 scale-125 cursor-pointer rounded-full bg-primary"
													: "size-2.5 cursor-pointer rounded-full bg-muted-foreground/30"
											}
										/>
									))}
								</div>
							) : null}
						</div>

						<div className="flex flex-col">
							<h3 className="mb-2 text-2xl font-extrabold text-foreground">{detailMedicine.name}</h3>
							<div className="mb-4 flex flex-wrap gap-2">
								{detailMedicine.category ? <Badge variant="secondary">{detailMedicine.category}</Badge> : null}
								{detailMedicine.prescription ? (
									<Badge variant="destructive">Rx Required</Badge>
								) : (
									<Badge className="bg-primary/15 text-primary hover:bg-primary/15">No Prescription</Badge>
								)}
							</div>
							<div className="mb-2 text-3xl font-extrabold text-primary">₹{detailMedicine.price}</div>
							{detailMedicine.retailerId ? (
								<p className="mb-4 text-xs text-muted-foreground">
									Sold by {detailMedicine.retailerId.firstName || ""} {detailMedicine.retailerId.lastName || ""}
								</p>
							) : null}
							<div className="mb-5 rounded-lg border border-border/70 bg-secondary/30 p-3.5">
								<h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</h4>
								<p className="text-sm leading-relaxed text-foreground/90">
									{detailMedicine.description || "No description provided."}
								</p>
							</div>
							<div className="mt-auto pt-4">
								{detailMedicine.quantity > 0 ? (
									<span className="text-sm font-semibold text-primary">In stock ({detailMedicine.quantity} available)</span>
								) : (
									<span className="text-sm font-semibold text-destructive">Out of stock</span>
								)}
							</div>
						</div>
					</div>
				) : (
					<>
						{/* Search & Filter Toolbar */}
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-b border-border/60 bg-muted/20 px-6 py-3.5">
							{/* Single sleek search bar without double rectangle */}
							<div className="relative flex-1 flex items-center rounded-lg border border-input bg-card px-3.5 py-2 shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
								<Search size={18} className="shrink-0 text-muted-foreground mr-2.5" />
								<input
									type="text"
									placeholder="Search by name, category, or description..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									autoFocus
									className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:outline-none focus:ring-0"
								/>
								{searchTerm ? (
									<button
										type="button"
										onClick={() => setSearchTerm("")}
										className="shrink-0 text-muted-foreground hover:text-foreground ml-2 cursor-pointer p-0.5"
									>
										<X size={16} />
									</button>
								) : null}
							</div>

							{/* Category Dropdown Filter */}
							{categories.length > 1 && (
								<div className="w-full sm:w-60 shrink-0">
									<Select
										value={selectedCategory}
										onValueChange={setSelectedCategory}
										items={categories.map((cat) => ({
											value: cat,
											label: cat === "All" ? "All Categories" : cat,
										}))}
									>
										<SelectTrigger className="h-10 bg-card border-input shadow-xs">
											<div className="flex items-center gap-2 truncate text-sm">
												<Filter size={14} className="text-muted-foreground shrink-0" />
												<SelectValue placeholder="All Categories" />
											</div>
										</SelectTrigger>
										<SelectContent className="max-h-64">
											{categories.map((cat) => (
												<SelectItem key={cat} value={cat}>
													{cat === "All" ? "All Categories" : cat}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						{/* Grid of Medicines */}
						<div className="flex-1 overflow-y-auto p-6">
							{loading ? (
								<div className="flex flex-col items-center justify-center gap-2.5 py-20 text-muted-foreground">
									<Loader2 className="size-8 animate-spin text-primary" />
									<p className="text-sm font-medium">Loading medicines inventory...</p>
								</div>
							) : error ? (
								<div className="flex items-center justify-center py-20 text-sm text-destructive">{error}</div>
							) : medicines.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
									<Pill className="size-10 text-muted-foreground/40" />
									<p className="text-sm font-medium text-muted-foreground">No medicines match your search criteria.</p>
								</div>
							) : (
								<div className="flex flex-col gap-6">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
										{medicines.map((medicine) => {
											const img = resolveImages(medicine)[0];
											return (
												<div
													key={medicine._id}
													className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-md cursor-pointer"
													onClick={() => openDetail(medicine)}
												>
													{/* Image Container */}
													<div className="relative aspect-4/3 w-full overflow-hidden bg-secondary/30 flex items-center justify-center p-2.5 border-b border-border/50">
														<img
															src={img}
															alt={medicine.name}
															className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
															loading="lazy"
															onError={(e) => {
																e.currentTarget.onerror = null;
																e.currentTarget.src = FALLBACK_IMAGE;
															}}
														/>
														{medicine.category ? (
															<span className="absolute top-2 left-2 rounded-md bg-card/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-foreground border border-border/60 shadow-xs">
																{medicine.category}
															</span>
														) : null}
														{medicine.quantity !== undefined && medicine.quantity <= 0 ? (
															<span className="absolute top-2 right-2 rounded-md bg-destructive text-white px-2 py-0.5 text-[10px] font-bold shadow-xs">
																Out of stock
															</span>
														) : null}
													</div>

													{/* Card Body */}
													<div className="flex flex-1 flex-col p-3.5 gap-2">
														<div className="flex-1">
															<h4 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors" title={medicine.name}>
																{medicine.name}
															</h4>
															<p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed min-h-[2rem]">
																{medicine.description || "Ayurvedic formulation"}
															</p>
														</div>

														<div className="flex items-center justify-between pt-2.5 border-t border-border/60 mt-auto">
															<span className="text-base font-extrabold text-primary">₹{medicine.price}</span>
															<Button
																size="sm"
																className="h-8 px-3 text-xs gap-1.5 font-semibold"
																onClick={(e) => {
																	e.stopPropagation();
																	confirmSelect(medicine);
																}}
															>
																<Check size={14} /> Select
															</Button>
														</div>
													</div>
												</div>
											);
										})}
									</div>

									{/* Load More Button */}
									{page < totalPages ? (
										<div className="flex justify-center pb-4 pt-2">
											<Button
												variant="outline"
												size="sm"
												onClick={handleLoadMore}
												disabled={loadingMore}
												className="min-w-[160px] gap-2 font-semibold"
											>
												{loadingMore ? (
													<>
														<Loader2 className="size-4 animate-spin" /> Loading more...
													</>
												) : (
													`Load More (${totalCount - medicines.length} remaining)`
												)}
											</Button>
										</div>
									) : null}
								</div>
							)}
						</div>
					</>
				)}

				{detailMedicine ? (
					<div className="flex justify-end border-t border-border bg-card p-4">
						<Button size="lg" className="gap-2 font-semibold" onClick={() => confirmSelect(detailMedicine)}>
							<Check size={16} /> Select this medicine
						</Button>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

export default MedicinePickerModal;

