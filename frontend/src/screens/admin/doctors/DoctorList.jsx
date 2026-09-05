import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	Trash2,
	Pencil,
	SearchIcon,
	Upload,
	Download,
	CheckSquare,
	ArrowLeft,
	Info,
	Star,
	Clock,
	CheckCircle,
	AlertTriangle,
} from "lucide-react";

import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { BACKEND_URL } from "@/config";
import { authFetch } from "@/utils/authFetch";
import { useUrlFilters } from "@/hooks/useUrlFilters";

const statusBadgeVariant = (status) => {
	if (status === "Approved") return "default";
	if (status === "Rejected") return "destructive";
	return "secondary";
};

const DoctorManagement = () => {
	const [doctors, setDoctors] = useState([]);

	// Filters + page live in the URL so navigating to a doctor's detail page
	// (handleRowClick below) and coming back restores them instead of resetting.
	const { values: urlFilters, setFilter } = useUrlFilters({
		q: "",
		status: "All",
		specialization: "All",
		gender: "All",
		price: "All",
		sort: "date_desc",
		page: "1",
	});
	const search = urlFilters.q;
	const setSearch = useCallback((v) => setFilter("q", v), [setFilter]);
	const statusFilter = urlFilters.status;
	const setStatusFilter = useCallback((v) => setFilter("status", v), [setFilter]);
	const specializationFilter = urlFilters.specialization;
	const setSpecializationFilter = useCallback((v) => setFilter("specialization", v), [setFilter]);
	const genderFilter = urlFilters.gender;
	const setGenderFilter = useCallback((v) => setFilter("gender", v), [setFilter]);
	const priceFilter = urlFilters.price;
	const setPriceFilter = useCallback((v) => setFilter("price", v), [setFilter]);
	const sortBy = urlFilters.sort;
	const setSortBy = useCallback((v) => setFilter("sort", v), [setFilter]);
	const currentPage = Number(urlFilters.page) || 1;
	const setCurrentPage = useCallback((p) => setFilter("page", String(p)), [setFilter]);
	const itemsPerPage = 10;
	const [selectedDoctors, setSelectedDoctors] = useState([]);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [doctorToEdit, setDoctorToEdit] = useState(null);
	const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
	const [isUploadReportOpen, setIsUploadReportOpen] = useState(false);
	const [uploadReport, setUploadReport] = useState(null);

	const navigate = useNavigate();

	const fetchAllDoctors = async () => {
		try {
			const token = localStorage.getItem("token") || "";
			const res = await authFetch(`${BACKEND_URL}/api/doctors/allDoctors`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) {
				if (res.status === 404) {
					setDoctors([]);
					return;
				}
				throw new Error("Failed to fetch doctors");
			}
			setDoctors(await res.json());
		} catch (error) {
			console.error("Error fetching doctors:", error);
		}
	};

	useEffect(() => {
		fetchAllDoctors();
	}, []);

	const getProcessedDoctors = () => {
		let result = [...doctors];

		if (search) {
			const q = search.toLowerCase();
			result = result.filter((d) => {
				const specStr = Array.isArray(d.specialization) ? d.specialization.join(" ").toLowerCase() : "";
				return (
					(d.firstName && d.firstName.toLowerCase().includes(q)) ||
					(d.lastName && d.lastName.toLowerCase().includes(q)) ||
					(d.email && d.email.toLowerCase().includes(q)) ||
					specStr.includes(q)
				);
			});
		}

		if (statusFilter === "ActiveToday") {
			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);
			result = result.filter((d) => d.lastLogin && new Date(d.lastLogin) >= todayStart);
		} else if (statusFilter !== "All") {
			result = result.filter((d) => d.approvalStatus === statusFilter);
		}

		if (specializationFilter !== "All") {
			result = result.filter((d) => {
				if (!d.specialization) return false;
				return Array.isArray(d.specialization)
					? d.specialization.includes(specializationFilter)
					: d.specialization === specializationFilter;
			});
		}

		if (genderFilter !== "All") {
			result = result.filter((d) => d.gender === genderFilter);
		}

		if (priceFilter !== "All") {
			result = result.filter((d) => {
				if (!d.price) return false;
				if (priceFilter === "<500") return d.price < 500;
				if (priceFilter === "500-1000") return d.price >= 500 && d.price <= 1000;
				if (priceFilter === ">1000") return d.price > 1000;
				return true;
			});
		}

		result.sort((a, b) => {
			if (sortBy === "name_asc") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
			if (sortBy === "name_desc") return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
			if (sortBy === "exp_desc") return (b.experience || 0) - (a.experience || 0);
			if (sortBy === "exp_asc") return (a.experience || 0) - (b.experience || 0);
			if (sortBy === "activity_desc") return new Date(b.lastLogin || 0) - new Date(a.lastLogin || 0);
			if (sortBy === "activity_asc") return new Date(a.lastLogin || 0) - new Date(b.lastLogin || 0);
			if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
			if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
			if (sortBy === "rating_desc") return (b.rating || 0) - (a.rating || 0);
			return 0;
		});

		return result;
	};

	const processedDoctors = getProcessedDoctors();
	const totalPages = Math.ceil(processedDoctors.length / itemsPerPage);
	const paginatedDoctors = processedDoctors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	// Skip the initial mount so a page number restored from the URL isn't
	// immediately stomped back to 1.
	const isFirstFilterRun = useRef(true);
	useEffect(() => {
		if (isFirstFilterRun.current) {
			isFirstFilterRun.current = false;
			return;
		}
		setCurrentPage(1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search, statusFilter, specializationFilter, genderFilter, priceFilter, sortBy]);

	const handleRowClick = (id) => navigate(`/admin/consultations/${id}`);

	const handleEditClick = (e, doctor) => {
		e.stopPropagation();
		setDoctorToEdit(doctor);
		setIsEditModalOpen(true);
	};

	const handleDeleteClick = async (e, id) => {
		e.stopPropagation();
		if (!window.confirm("Are you sure you want to delete this doctor?")) return;
		try {
			const token = localStorage.getItem("token") || "";
			const res = await authFetch(`${BACKEND_URL}/api/doctors/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				setDoctors(doctors.filter((d) => d._id !== id));
				setSelectedDoctors((prev) => prev.filter((selectedId) => selectedId !== id));
			} else {
				alert("Failed to delete doctor.");
			}
		} catch (error) {
			console.error("Error deleting doctor:", error);
		}
	};

	const handleFileUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("file", file);

		try {
			const token = localStorage.getItem("token") || "";
			const res = await authFetch(`${BACKEND_URL}/api/doctors/upload`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});
			const data = await res.json();
			if (res.ok) {
				setUploadReport(data);
				setIsUploadReportOpen(true);

				if (data.generatedCredentials && data.generatedCredentials.length > 0) {
					const csvRows = ["Email,Temporary Password"];
					data.generatedCredentials.forEach((cred) => {
						csvRows.push(`"${cred.email}","${cred.tempPassword}"`);
					});
					const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
					const url = window.URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.setAttribute("href", url);
					a.setAttribute("download", "doctor_credentials.csv");
					a.click();
				}

				fetchAllDoctors();
			} else {
				alert(data.message || "Failed to upload.");
			}
		} catch (error) {
			console.error("Upload error:", error);
			alert("Upload error.");
		} finally {
			e.target.value = null;
		}
	};

	const handleSaveChanges = async (updatedDoctor) => {
		try {
			const token = localStorage.getItem("token") || "";
			const res = await authFetch(`${BACKEND_URL}/api/doctors/updateDoctor/${updatedDoctor._id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify(updatedDoctor),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setDoctors(doctors.map((doc) => (doc._id === updatedDoctor._id ? updatedDoctor : doc)));
				setIsEditModalOpen(false);
				setDoctorToEdit(null);
			} else {
				alert(data.message || "Failed to update profile");
			}
		} catch (error) {
			console.error("Error updating doctor:", error);
			alert("An error occurred while updating.");
		}
	};

	const toggleSelectAll = () => {
		setSelectedDoctors(
			selectedDoctors.length === paginatedDoctors.length ? [] : paginatedDoctors.map((d) => d._id),
		);
	};

	const toggleSelectDoctor = (e, id) => {
		e.stopPropagation();
		setSelectedDoctors((prev) => (prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]));
	};

	const handleBulkVerify = async (status) => {
		if (selectedDoctors.length === 0) return;
		if (!window.confirm(`Mark ${selectedDoctors.length} selected doctors as ${status}?`)) return;
		try {
			const token = localStorage.getItem("token") || "";
			const res = await authFetch(`${BACKEND_URL}/api/doctors/bulk-verify`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ doctorIds: selectedDoctors, approvalStatus: status }),
			});
			const data = await res.json();
			if (res.ok) {
				alert(data.message);
				fetchAllDoctors();
				setSelectedDoctors([]);
			} else {
				alert(data.message || "Bulk update failed");
			}
		} catch (error) {
			console.error("Bulk update error:", error);
			alert("An error occurred during bulk update.");
		}
	};

	const handleBulkDelete = async () => {
		if (selectedDoctors.length === 0) return;
		if (!window.confirm(`Are you sure you want to permanently delete ${selectedDoctors.length} selected doctors?`)) return;
		try {
			const token = localStorage.getItem("token") || "";
			const res = await authFetch(`${BACKEND_URL}/api/doctors/bulk-delete`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ doctorIds: selectedDoctors }),
			});
			const data = await res.json();
			if (res.ok) {
				alert(data.message);
				fetchAllDoctors();
				setSelectedDoctors([]);
			} else {
				alert(data.message || "Bulk delete failed");
			}
		} catch (error) {
			console.error("Bulk delete error:", error);
			alert("An error occurred during bulk delete.");
		}
	};

	const handleExportCSV = () => {
		if (processedDoctors.length === 0) {
			alert("No doctors to export");
			return;
		}
		const headers = ["First Name", "Last Name", "Email", "Phone", "Specialization", "Experience", "Price", "Status", "Rating", "Last Login"];
		const csvRows = [headers.join(",")];
		processedDoctors.forEach((d) => {
			const specs = Array.isArray(d.specialization) ? d.specialization.join(" | ") : d.specialization || "";
			const loginDate = formatDate(d.lastLogin, "Never");
			csvRows.push(
				[
					`"${d.firstName || ""}"`,
					`"${d.lastName || ""}"`,
					`"${d.email || ""}"`,
					`"${d.phone || ""}"`,
					`"${specs}"`,
					`"${d.experience || 0}"`,
					`"${d.price || 0}"`,
					`"${d.approvalStatus || "Pending"}"`,
					`"${d.rating ? d.rating.toFixed(1) : "N/A"}"`,
					`"${loginDate}"`,
				].join(","),
			);
		});
		const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.setAttribute("href", url);
		a.setAttribute("download", "doctors_export.csv");
		a.click();
	};

	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	const metrics = [
		{ key: "All", label: "Total Doctors", value: doctors.length },
		{ key: "Pending", label: "Pending Review", value: doctors.filter((d) => d.approvalStatus === "Pending").length },
		{ key: "Approved", label: "Approved", value: doctors.filter((d) => d.approvalStatus === "Approved").length },
		{
			key: "ActiveToday",
			label: "Active Today",
			value: doctors.filter((d) => d.lastLogin && new Date(d.lastLogin) >= todayStart).length,
		},
	];

	const uniqueSpecializations = [
		"All",
		...new Set(
			doctors.flatMap((d) =>
				Array.isArray(d.specialization) && d.specialization.length > 0 ? d.specialization : ["Not specified"],
			),
		),
	];

	return (
		<DashboardShell>
			<div className="mb-4">
				<Button variant="outline" size="sm" onClick={() => navigate(-1)}>
					<ArrowLeft data-icon="inline-start" />
					Back
				</Button>
			</div>
			<DashboardPageHeader title="Doctor Management" description="Review, verify, and manage doctors on the platform." />

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				{metrics.map((metric) => (
					<Card
						key={metric.key}
						onClick={() => setStatusFilter(metric.key)}
						className={cn(
							"cursor-pointer text-center ring-foreground/10 transition-colors hover:bg-muted/60",
							statusFilter === metric.key && "ring-2 ring-primary",
						)}
					>
						<CardContent>
							<p className="text-2xl font-bold text-foreground">{metric.value}</p>
							<p className="text-sm font-semibold text-muted-foreground">{metric.label}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card className="mb-6">
				<CardContent className="flex flex-wrap gap-3">
					<div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-input px-3">
						<SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<Input
							placeholder="Search by name, email, or specialization..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-auto border-0 p-2 shadow-none focus-visible:ring-0"
						/>
					</div>

					<Select
						value={statusFilter}
						onValueChange={setStatusFilter}
						items={[
							{ value: "All", label: "All Statuses" },
							{ value: "Pending", label: "Pending" },
							{ value: "Approved", label: "Approved" },
							{ value: "Rejected", label: "Rejected" },
							{ value: "ActiveToday", label: "Active Today" },
						]}
					>
						<SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="All">All Statuses</SelectItem>
							<SelectItem value="Pending">Pending</SelectItem>
							<SelectItem value="Approved">Approved</SelectItem>
							<SelectItem value="Rejected">Rejected</SelectItem>
							<SelectItem value="ActiveToday">Active Today</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={specializationFilter}
						onValueChange={setSpecializationFilter}
						items={uniqueSpecializations.map((spec) => ({ value: spec, label: spec }))}
					>
						<SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
						<SelectContent>
							{uniqueSpecializations.map((spec) => (
								<SelectItem key={spec} value={spec}>{spec}</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={genderFilter}
						onValueChange={setGenderFilter}
						items={[
							{ value: "All", label: "All Genders" },
							{ value: "Male", label: "Male" },
							{ value: "Female", label: "Female" },
							{ value: "Other", label: "Other" },
						]}
					>
						<SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="All">All Genders</SelectItem>
							<SelectItem value="Male">Male</SelectItem>
							<SelectItem value="Female">Female</SelectItem>
							<SelectItem value="Other">Other</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={priceFilter}
						onValueChange={setPriceFilter}
						items={[
							{ value: "All", label: "All Prices" },
							{ value: "<500", label: "Under ₹500" },
							{ value: "500-1000", label: "₹500 - ₹1000" },
							{ value: ">1000", label: "Above ₹1000" },
						]}
					>
						<SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="All">All Prices</SelectItem>
							<SelectItem value="<500">Under ₹500</SelectItem>
							<SelectItem value="500-1000">₹500 - ₹1000</SelectItem>
							<SelectItem value=">1000">Above ₹1000</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={sortBy}
						onValueChange={setSortBy}
						items={[
							{ value: "date_desc", label: "Newest First" },
							{ value: "name_asc", label: "Name (A-Z)" },
							{ value: "name_desc", label: "Name (Z-A)" },
							{ value: "exp_desc", label: "Experience (High to Low)" },
							{ value: "exp_asc", label: "Experience (Low to High)" },
							{ value: "activity_desc", label: "Highest Activity" },
							{ value: "activity_asc", label: "Lowest Activity" },
							{ value: "rating_desc", label: "Highest Rated" },
							{ value: "price_asc", label: "Price (Low to High)" },
							{ value: "price_desc", label: "Price (High to Low)" },
						]}
					>
						<SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
						<SelectContent>
							<SelectItem value="date_desc">Newest First</SelectItem>
							<SelectItem value="name_asc">Name (A-Z)</SelectItem>
							<SelectItem value="name_desc">Name (Z-A)</SelectItem>
							<SelectItem value="exp_desc">Experience (High to Low)</SelectItem>
							<SelectItem value="exp_asc">Experience (Low to High)</SelectItem>
							<SelectItem value="activity_desc">Highest Activity</SelectItem>
							<SelectItem value="activity_asc">Lowest Activity</SelectItem>
							<SelectItem value="rating_desc">Highest Rated</SelectItem>
							<SelectItem value="price_asc">Price (Low to High)</SelectItem>
							<SelectItem value="price_desc">Price (High to Low)</SelectItem>
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				{selectedDoctors.length > 0 ? (
					<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
						<span className="text-sm font-semibold text-foreground">{selectedDoctors.length} selected</span>
						<Button size="sm" onClick={() => handleBulkVerify("Approved")}>Approve</Button>
						<Button size="sm" variant="secondary" onClick={() => handleBulkVerify("Rejected")}>Reject</Button>
						<Button size="sm" variant="destructive" onClick={handleBulkDelete}>Delete</Button>
						<Button size="sm" variant="ghost" onClick={() => setSelectedDoctors([])}>Clear</Button>
					</div>
				) : (
					<span className="text-sm text-muted-foreground">Select doctors to perform bulk actions</span>
				)}

				<div className="flex gap-2">
					<Button variant="secondary" onClick={handleExportCSV}>
						<Download data-icon="inline-start" />
						Export CSV
					</Button>
					<Button render={<label htmlFor="excel-upload" />} className="cursor-pointer">
						<Upload data-icon="inline-start" />
						Upload Excel
						<span
							role="button"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setIsInfoModalOpen(true);
							}}
							className="ml-1 border-l border-primary-foreground/30 pl-1.5"
							title="View Upload Instructions"
						>
							<Info className="size-4" />
						</span>
					</Button>
					<input type="file" id="excel-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
				</div>
			</div>

			<Card className="overflow-hidden">
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-10">
									<input
										type="checkbox"
										checked={paginatedDoctors.length > 0 && selectedDoctors.length === paginatedDoctors.length}
										onChange={toggleSelectAll}
										className="size-4 cursor-pointer"
									/>
								</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Specialization</TableHead>
								<TableHead>Exp / Price</TableHead>
								<TableHead>Rating / Activity</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{paginatedDoctors.length > 0 ? (
								paginatedDoctors.map((doctor) => (
									<TableRow key={doctor._id} onClick={() => handleRowClick(doctor._id)} className="cursor-pointer">
										<TableCell onClick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedDoctors.includes(doctor._id)}
												onChange={(e) => toggleSelectDoctor(e, doctor._id)}
												className="size-4 cursor-pointer"
											/>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2.5">
												<Avatar>
													<AvatarFallback>{doctor.firstName?.charAt(0) || "D"}</AvatarFallback>
												</Avatar>
												<div>
													<div className="font-semibold text-foreground">{doctor.firstName} {doctor.lastName}</div>
													<div className="text-xs text-muted-foreground">{doctor.email}</div>
												</div>
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{Array.isArray(doctor.specialization) && doctor.specialization.length > 0
												? (() => {
														const specStr = doctor.specialization.join(", ");
														return specStr.length > 30 ? `${specStr.slice(0, 30)}...` : specStr;
													})()
												: "Not specified"}
										</TableCell>
										<TableCell>
											<div className="text-muted-foreground">{doctor.experience || 0} years</div>
											<div className="text-xs font-semibold text-primary">₹{doctor.price || 0}</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												<Star fill={doctor.rating ? "currentColor" : "none"} className={doctor.rating ? "size-3.5 text-primary" : "size-3.5 text-muted-foreground"} />
												<span className="font-semibold text-foreground">{doctor.rating ? doctor.rating.toFixed(1) : "N/A"}</span>
											</div>
											<div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
												<Clock className="size-3" /> {formatDate(doctor.lastLogin, "Never")}
											</div>
										</TableCell>
										<TableCell>
											<Badge variant={statusBadgeVariant(doctor.approvalStatus)}>{doctor.approvalStatus || "Pending"}</Badge>
										</TableCell>
										<TableCell>
											<div className="flex gap-2">
												<Button size="sm" variant="outline" onClick={(e) => handleEditClick(e, doctor)}>
													<Pencil data-icon="inline-start" /> Edit
												</Button>
												<Button size="sm" variant="destructive" onClick={(e) => handleDeleteClick(e, doctor._id)}>
													<Trash2 />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
										No doctors found matching the criteria.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</Card>

			{totalPages > 1 ? (
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
					<span className="text-sm text-muted-foreground">
						Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, processedDoctors.length)} of {processedDoctors.length} doctors
					</span>
					<div className="flex gap-1.5">
						<Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}>
							Previous
						</Button>
						{Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
							<Button key={page} size="sm" variant={currentPage === page ? "default" : "outline"} onClick={() => setCurrentPage(page)}>
								{page}
							</Button>
						))}
						<Button size="sm" variant="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}>
							Next
						</Button>
					</div>
				</div>
			) : null}

			<Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
				<DialogContent className="max-w-lg">
					{doctorToEdit ? (
						<>
							<DialogHeader>
								<DialogTitle>Edit Doctor Profile</DialogTitle>
							</DialogHeader>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="dl-first-name">First Name</FieldLabel>
									<Input id="dl-first-name" value={doctorToEdit.firstName} onChange={(e) => setDoctorToEdit({ ...doctorToEdit, firstName: e.target.value })} />
								</Field>
								<Field>
									<FieldLabel htmlFor="dl-last-name">Last Name</FieldLabel>
									<Input id="dl-last-name" value={doctorToEdit.lastName} onChange={(e) => setDoctorToEdit({ ...doctorToEdit, lastName: e.target.value })} />
								</Field>
								<Field>
									<FieldLabel htmlFor="dl-email">Email</FieldLabel>
									<Input id="dl-email" type="email" value={doctorToEdit.email} onChange={(e) => setDoctorToEdit({ ...doctorToEdit, email: e.target.value })} />
								</Field>
								<Field>
									<FieldLabel htmlFor="dl-phone">Phone</FieldLabel>
									<Input id="dl-phone" value={doctorToEdit.phone} onChange={(e) => setDoctorToEdit({ ...doctorToEdit, phone: e.target.value })} />
								</Field>
								<Field>
									<FieldLabel htmlFor="dl-spec">Specialization (comma separated)</FieldLabel>
									<Input
										id="dl-spec"
										value={Array.isArray(doctorToEdit.specialization) ? doctorToEdit.specialization.join(", ") : doctorToEdit.specialization}
										onChange={(e) => setDoctorToEdit({ ...doctorToEdit, specialization: e.target.value.split(",").map((s) => s.trim()) })}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="dl-exp">Experience (Years)</FieldLabel>
									<Input id="dl-exp" type="number" value={doctorToEdit.experience} onChange={(e) => setDoctorToEdit({ ...doctorToEdit, experience: e.target.value })} />
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
								<Button onClick={() => handleSaveChanges(doctorToEdit)}>Save Changes</Button>
							</DialogFooter>
						</>
					) : null}
				</DialogContent>
			</Dialog>

			<Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
				<DialogContent className="max-h-[90vh] max-w-4xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-2xl"><Info className="size-6" /> Excel Upload Guide</DialogTitle>
						<p className="text-sm text-muted-foreground">Follow this exact structure to seamlessly upload multiple doctors. We will securely handle the rest!</p>
					</DialogHeader>

					<div className="flex flex-wrap gap-6 overflow-y-auto">
						<Card className="flex-[0.6] min-w-64">
							<CardContent>
								<Badge variant="secondary" className="mb-3">REQUIRED FIELDS</Badge>
								<Table>
									<TableHeader>
										<TableRow><TableHead>firstName</TableHead><TableHead>lastName</TableHead><TableHead>email</TableHead></TableRow>
									</TableHeader>
									<TableBody>
										<TableRow><TableCell>Aditi</TableCell><TableCell>Sharma</TableCell><TableCell>aditi.s@clinic.com</TableCell></TableRow>
										<TableRow><TableCell>Rajesh</TableCell><TableCell>Kumar</TableCell><TableCell>rajesh.k@ayur.in</TableCell></TableRow>
									</TableBody>
								</Table>
							</CardContent>
						</Card>

						<Card className="flex-[1.4] min-w-64">
							<CardContent>
								<Badge variant="secondary" className="mb-3">OPTIONAL FIELDS</Badge>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>phone</TableHead><TableHead>specialization</TableHead><TableHead>experience</TableHead>
											<TableHead>gender</TableHead><TableHead>price</TableHead><TableHead>password</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										<TableRow>
											<TableCell>+919876543210</TableCell><TableCell>Cardiology, Ayurveda</TableCell><TableCell>8</TableCell>
											<TableCell>Female</TableCell><TableCell>800</TableCell><TableCell className="font-mono">********</TableCell>
										</TableRow>
										<TableRow>
											<TableCell />
											<TableCell>Panchakarma</TableCell><TableCell>12</TableCell>
											<TableCell>Male</TableCell><TableCell>1200</TableCell><TableCell />
										</TableRow>
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						{[
							{ icon: CheckSquare, title: "Auto-Generated Credentials", text: "If the password column is missing or shorter than 8 characters, we automatically generate a secure 8-character password." },
							{ icon: Download, title: "CSV Download", text: "After a successful upload, you'll receive a CSV of generated credentials. Keep this safe to distribute to your new doctors." },
							{ icon: Star, title: "Forced Security Reset", text: "On first login, every doctor is redirected to a secure screen and forced to change their password." },
						].map((item) => (
							<Card key={item.title}>
								<CardContent>
									<span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><item.icon className="size-5" /></span>
									<h4 className="mb-1.5 font-semibold text-foreground">{item.title}</h4>
									<p className="text-sm text-muted-foreground">{item.text}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isUploadReportOpen} onOpenChange={setIsUploadReportOpen}>
				<DialogContent className="max-h-[85vh] max-w-2xl">
					{uploadReport ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2"><CheckCircle className="size-6 text-primary" /> Upload Results Report</DialogTitle>
							</DialogHeader>

							<div className="overflow-y-auto">
								<div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm font-semibold text-foreground">
									<CheckCircle className="size-5 shrink-0" />
									{uploadReport.message}
								</div>

								{uploadReport.generatedCredentials && uploadReport.generatedCredentials.length > 0 ? (
									<div className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
										<strong>Note:</strong> A CSV file containing {uploadReport.generatedCredentials.length} auto-generated credentials has been downloaded. Please distribute these to the respective doctors.
									</div>
								) : null}

								{uploadReport.skippedCount > 0 ? (
									<div>
										<h4 className="mb-3 flex items-center gap-2 border-b border-destructive pb-2 font-semibold text-destructive">
											<AlertTriangle className="size-5" /> Failed to Register: {uploadReport.skippedCount} Doctors
										</h4>
										<Table>
											<TableHeader>
												<TableRow><TableHead>Excel Row</TableHead><TableHead>Reason for Failure</TableHead></TableRow>
											</TableHeader>
											<TableBody>
												{uploadReport.skippedRows.map((skip, idx) => (
													<TableRow key={idx}>
														<TableCell className="font-semibold text-muted-foreground">Row {skip.row}</TableCell>
														<TableCell className="text-destructive">{skip.reason}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								) : (
									<div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
										All doctors in the Excel file were successfully registered! No rows were skipped.
									</div>
								)}
							</div>

							<DialogFooter>
								<Button onClick={() => setIsUploadReportOpen(false)}>Done</Button>
							</DialogFooter>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</DashboardShell>
	);
};

export default DoctorManagement;
