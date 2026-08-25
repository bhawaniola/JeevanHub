import { useState, useEffect, useContext } from "react";
import {
	PieChart,
	Pie,
	Cell,
	LineChart,
	Line,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	BarChart,
	Bar,
	LabelList,
	ScatterChart,
	Scatter,
	ResponsiveContainer,
} from "recharts";

import { 
	CreditCard, 
	Users, 
	UserCheck, 
	CalendarDays, 
	Star 
} from "lucide-react";

import { BACKEND_URL } from "../../config";
import { authFetch } from "../../utils/authFetch";
import { AuthContext } from "../../context/AuthContext";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
	const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
	const x = cx + radius * Math.cos(-midAngle * RADIAN);
	const y = cy + radius * Math.sin(-midAngle * RADIAN);

	if (percent === 0) return null;

	return (
		<text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize="14">
			{`${(percent * 100).toFixed(0)}%`}
		</text>
	);
};

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
const SERIES_COLOR = "var(--primary)";
const AXIS_COLOR = "var(--muted-foreground)";
const GRID_COLOR = "var(--border)";

const tooltipContentStyle = {
	borderRadius: "var(--jh-radius-md, 8px)",
	border: "1px solid var(--border)",
	background: "var(--popover)",
	color: "var(--popover-foreground)",
	boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
};

function DoctorAnalytics() {
	const [bookings, setBookings] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState("payments");
	const [filterRange, setFilterRange] = useState("all");
	const [searchDate, setSearchDate] = useState("");

	const { auth } = useContext(AuthContext);
	const doctorId = auth.user?.id;

	useEffect(() => {
		const fetchBookings = async () => {
			if (!doctorId) {
				setLoading(false);
				setError("Error: Doctor ID not found.");
				return;
			}

			try {
				const response = await authFetch(`${BACKEND_URL}/api/bookings/doctor/${doctorId}`, {
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
				});
				if (!response.ok) {
					throw new Error("Failed to fetch bookings");
				}

				const data = await response.json();
				const doctorBookings = Array.isArray(data.bookings) ? data.bookings : [];
				setBookings(doctorBookings);
				setLoading(false);
			} catch (error) {
				setError(error.message);
				setLoading(false);
			}
		};

		fetchBookings();
	}, [doctorId]);

	const acceptedBookings = bookings.filter((b) => b.requestAccept === "accepted");
	const nowTime = new Date();
	const completedBookings = acceptedBookings.filter((b) => new Date(b.dateOfAppointment) < nowTime);

	const genderData = [
		{ name: "Male", value: completedBookings.filter((b) => b.patientGender === "Male").length },
		{ name: "Female", value: completedBookings.filter((b) => b.patientGender === "Female").length },
		{ name: "Other", value: completedBookings.filter((b) => b.patientGender === "Other").length },
	].filter((d) => d.value > 0);

	const ageData = [
		{ ageGroup: "0-10", count: completedBookings.filter((b) => b.patientAge >= 0 && b.patientAge <= 10).length },
		{ ageGroup: "11-20", count: completedBookings.filter((b) => b.patientAge >= 11 && b.patientAge <= 20).length },
		{ ageGroup: "21-30", count: completedBookings.filter((b) => b.patientAge >= 21 && b.patientAge <= 30).length },
		{ ageGroup: "31-40", count: completedBookings.filter((b) => b.patientAge >= 31 && b.patientAge <= 40).length },
		{ ageGroup: "41-50", count: completedBookings.filter((b) => b.patientAge >= 41 && b.patientAge <= 50).length },
		{ ageGroup: "51+", count: completedBookings.filter((b) => b.patientAge >= 51).length },
	];

	const currentYear = new Date().getFullYear();
	const currentYearBookings = completedBookings.filter(
		(booking) => new Date(booking.dateOfAppointment).getFullYear() === currentYear
	);

	const monthlyData = Array.from({ length: 12 }, (_, i) => {
		return {
			month: new Date(currentYear, i).toLocaleString("default", { month: "short" }),
			count: currentYearBookings.filter((booking) => new Date(booking.dateOfAppointment).getMonth() === i).length,
		};
	});

	const completedCount = completedBookings.length;
	const totalAppointments = completedCount;

	const ageChartData = ageData.map((item) => {
		const pct = completedCount > 0 ? Math.round((item.count / completedCount) * 100) : 0;
		return {
			...item,
			percentage: pct,
			labelText: `${item.count} (${pct}%)`,
		};
	});

	const todayStr = new Date().toDateString();
	const todayAppointments = completedBookings.filter(
		(b) => new Date(b.dateOfAppointment).toDateString() === todayStr
	).length;

	const uniqueDays = new Set(completedBookings.map((b) => new Date(b.dateOfAppointment).toDateString())).size;
	const avgPerDay = uniqueDays > 0 ? (completedBookings.length / uniqueDays).toFixed(1) : "0.0";

	const totalRaw = bookings.length;
	const completedPct = totalRaw > 0 ? Math.round((completedCount / totalRaw) * 100) : 0;

	const cancelledCount = bookings.filter((b) => b.requestAccept === "denied").length;
	const cancelledPct = totalRaw > 0 ? Math.round((cancelledCount / totalRaw) * 100) : 0;

	const noShowCount = acceptedBookings.filter(
		(b) => new Date(b.dateOfAppointment) < nowTime && b.paymentStatus === "Pending"
	).length;
	const noShowPct = totalRaw > 0 ? Math.round((noShowCount / totalRaw) * 100) : 0;

	// Calculate live growth rate (last 30 days vs previous 30 days)
	const msInDay = 24 * 60 * 60 * 1000;
	const last30DaysCount = acceptedBookings.filter((b) => {
		const diff = nowTime - new Date(b.dateOfAppointment);
		return diff >= 0 && diff <= 30 * msInDay;
	}).length;

	const prev30DaysCount = acceptedBookings.filter((b) => {
		const diff = nowTime - new Date(b.dateOfAppointment);
		return diff > 30 * msInDay && diff <= 60 * msInDay;
	}).length;

	const absoluteDiff = last30DaysCount - prev30DaysCount;
	let growthText = "0";
	let growthColor = "text-muted-foreground";

	if (absoluteDiff > 0) {
		growthText = `▲ +${absoluteDiff}`;
		growthColor = "text-emerald-600";
	} else if (absoluteDiff < 0) {
		growthText = `▼ ${absoluteDiff}`;
		growthColor = "text-destructive";
	} else {
		growthText = "0";
		growthColor = "text-muted-foreground";
	}

	const ratedBookings = completedBookings.filter(
		(b) => b.rating !== null && b.rating !== undefined
	);

	const monthlyRatingsData = Array.from({ length: 12 }, (_, i) => {
		const monthBookings = ratedBookings.filter(
			(b) => new Date(b.dateOfAppointment).getFullYear() === currentYear &&
			       new Date(b.dateOfAppointment).getMonth() === i
		);
		const sum = monthBookings.reduce((acc, b) => acc + b.rating, 0);
		const count = monthBookings.length;
		return {
			month: new Date(currentYear, i).toLocaleString("default", { month: "short" }),
			averageRating: count > 0 ? parseFloat((sum / count).toFixed(1)) : null,
		};
	});

	// Helper to get the actual payment date (fallback to createdAt if paymentConfirmedAt is missing)
	const getPaymentDate = (b) => b.paymentConfirmedAt || b.createdAt;

	// Payment history: only appointments the doctor actually got paid for --
	// accepted + a completed payment (Razorpay-verified or doctor-confirmed proof).
	const paidBookings = acceptedBookings
		.filter((b) => b.amountPaid > 0 && b.paymentStatus === "Completed")
		.sort((a, b) => new Date(getPaymentDate(b)) - new Date(getPaymentDate(a)));

	const getFilteredPayments = () => {
		const now = new Date();
		return paidBookings.filter((b) => {
			const paymentDate = new Date(getPaymentDate(b));

			if (searchDate) {
				const sDate = new Date(searchDate);
				return paymentDate.toDateString() === sDate.toDateString();
			}

			if (filterRange === "today") {
				return paymentDate.toDateString() === now.toDateString();
			}
			if (filterRange === "week") {
				const oneWeekAgo = new Date();
				oneWeekAgo.setDate(now.getDate() - 7);
				return paymentDate >= oneWeekAgo;
			}
			if (filterRange === "month") {
				const oneMonthAgo = new Date();
				oneMonthAgo.setDate(now.getDate() - 30);
				return paymentDate >= oneMonthAgo;
			}
			return true; // "all"
		});
	};

	const filteredPaidBookings = getFilteredPayments();

	if (loading) {
		return (
			<DashboardShell>
				<Skeleton className="h-12 w-full rounded-lg mb-6" />
				<Skeleton className="h-[400px] w-full rounded-xl" />
			</DashboardShell>
		);
	}

	if (error) {
		return (
			<DashboardShell>
				<p className="mx-auto w-fit rounded-lg bg-destructive/10 px-6 py-4 font-medium text-destructive">
					Error: {error}
				</p>
			</DashboardShell>
		);
	}

	const tabs = [
		{ id: "payments", label: "Payments & Earnings", icon: CreditCard },
		{ id: "gender", label: "Gender Distribution", icon: Users },
		{ id: "age", label: "Age Distribution", icon: UserCheck },
		{ id: "appointments", label: "Monthly Appointments", icon: CalendarDays },
		{ id: "ratings", label: "Patient Ratings", icon: Star },
	];

	return (
		<DashboardShell>
			<DashboardPageHeader
				title="Analytics Dashboard"
				description="Track your performance, payments, and patient statistics."
			/>

			{/* Sub-navigation tabs */}
			<div className="mb-6 flex flex-wrap gap-2 rounded-xl bg-muted p-1">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
								isActive
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:bg-background/40 hover:text-foreground"
							}`}
						>
							<Icon className="h-4 w-4" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Render dynamic section content based on activeTab */}
			<div className="transition-all duration-300">
				{activeTab === "payments" && (
					<Card className="overflow-hidden p-0">
						<div className="border-b border-border p-6 pb-4 flex flex-wrap items-center justify-between gap-4">
							<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
								<CreditCard className="h-5 w-5 text-primary" /> Payment History
							</h2>
							<div className="flex flex-wrap items-center gap-4">
								<div className="flex items-center gap-2">
									<label htmlFor="search-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Date:</label>
									<input
										id="search-date"
										type="date"
										value={searchDate}
										onClick={(e) => {
											try {
												e.target.showPicker();
											} catch (err) {
												console.error(err);
											}
										}}
										onChange={(e) => setSearchDate(e.target.value)}
										className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus:border-primary focus:outline-none cursor-pointer"
									/>
									{searchDate && (
										<button
											onClick={() => setSearchDate("")}
											className="text-xs text-destructive hover:underline font-semibold"
										>
											Clear
										</button>
									)}
								</div>
								<div className="flex items-center gap-2">
									<label htmlFor="payment-filter" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter:</label>
									<select
										id="payment-filter"
										value={filterRange}
										onChange={(e) => setFilterRange(e.target.value)}
										className={`rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm focus:border-primary focus:outline-none ${
											searchDate ? "opacity-50 pointer-events-none" : ""
										}`}
										disabled={!!searchDate}
									>
										<option value="all">All Payments</option>
										<option value="today">Today</option>
										<option value="week">Last 7 Days</option>
										<option value="month">Last 30 Days</option>
									</select>
								</div>
							</div>
						</div>
						{filteredPaidBookings.length === 0 ? (
							<p className="p-6 text-center text-muted-foreground">No payments found for this timeframe.</p>
						) : (
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="pl-6">Patient</TableHead>
											<TableHead>Payment Date</TableHead>
											<TableHead>Appointment Date</TableHead>
											<TableHead className="pr-6 text-right">Amount</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredPaidBookings.map((b) => (
											<TableRow key={b._id}>
												<TableCell className="pl-6 font-medium">{b.patientName}</TableCell>
												<TableCell>
													{new Date(getPaymentDate(b)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
												</TableCell>
												<TableCell>
													{new Date(b.dateOfAppointment).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
												</TableCell>
												<TableCell className="pr-6 text-right font-bold text-primary">₹{b.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</Card>
				)}

				{activeTab === "gender" && (
					<Card className="p-6">
						<h2 className="mb-5 border-b border-border pb-3 text-lg font-semibold text-foreground flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" /> Patient Gender Distribution
						</h2>
						{genderData.length === 0 ? (
							<p className="py-12 text-center text-muted-foreground">No gender data available.</p>
						) : (
							<div className="flex flex-col items-center justify-center md:flex-row md:gap-12">
								<ResponsiveContainer width="100%" height={320} className="max-w-[400px]">
									<PieChart>
										<Pie
											data={genderData}
											cx="50%"
											cy="50%"
											innerRadius={80}
											outerRadius={120}
											dataKey="value"
											label={renderCustomizedLabel}
											labelLine={false}
											stroke="none"
										>
											{genderData.map((_entry, index) => (
												<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
											))}
										</Pie>
										<Tooltip contentStyle={tooltipContentStyle} />
									</PieChart>
								</ResponsiveContainer>
								<div className="flex flex-col gap-4 mt-6 md:mt-0">
									{genderData.map((d, index) => (
										<div key={d.name} className="flex items-center gap-3">
											<div className="h-4 w-4 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
											<span className="text-sm font-semibold text-foreground">{d.name}:</span>
											<span className="text-sm text-muted-foreground">{d.value} patient(s)</span>
										</div>
									))}
								</div>
							</div>
						)}
					</Card>
				)}

				{activeTab === "age" && (
					<Card className="p-6">
						<h2 className="mb-5 border-b border-border pb-3 text-lg font-semibold text-foreground flex items-center gap-2">
							<UserCheck className="h-5 w-5 text-primary" /> Patient Age Distribution
						</h2>
						<ResponsiveContainer width="100%" height={320}>
							<BarChart
								data={ageChartData}
								margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
							>
								<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
								<XAxis dataKey="ageGroup" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR }} tickLine={false} axisLine={false} />
								<YAxis
									stroke={AXIS_COLOR}
									tick={{ fill: AXIS_COLOR }}
									tickLine={false}
									axisLine={false}
									allowDecimals={false}
								/>
								<Tooltip cursor={{ fill: "var(--muted)", opacity: 0.15 }} contentStyle={tooltipContentStyle} />
								<Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]}>
									<LabelList dataKey="labelText" position="top" style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: "600" }} />
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</Card>
				)}

				{activeTab === "appointments" && (
					<Card className="p-6">
						<div className="flex flex-col gap-6">
							<h2 className="border-b border-border pb-3 text-lg font-semibold text-foreground flex items-center gap-2">
								<CalendarDays className="h-5 w-5 text-primary" /> Appointments Overview
							</h2>

							{/* Top Summary stats cards */}
							<div className="grid grid-cols-2 gap-4">
								<div className="rounded-lg bg-muted/50 p-4">
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appointments (Last 30 Days)</p>
									<div className="mt-1.5 flex items-baseline gap-2">
										<span className="text-3xl font-bold text-foreground">{last30DaysCount}</span>
										<span className={`text-xs font-semibold flex items-center ${growthColor}`}>
											{growthText}
										</span>
									</div>
									<p className="mt-0.5 text-[10px] text-muted-foreground">vs previous 30 days</p>
								</div>
								<div className="rounded-lg bg-muted/50 p-4">
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today</p>
									<div className="mt-1.5 flex items-baseline gap-2">
										<span className="text-3xl font-bold text-foreground">{todayAppointments}</span>
										<span className="text-xs text-muted-foreground ml-1">Appointments</span>
									</div>
									<p className="mt-0.5 text-[10px] text-muted-foreground">done today</p>
								</div>
							</div>

							{/* The Area Chart */}
							<ResponsiveContainer width="100%" height={260}>
								<AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
									<defs>
										<linearGradient id="appointmentGradient" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
											<stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
										</linearGradient>
									</defs>
									<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
									<XAxis dataKey="month" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR }} tickLine={false} axisLine={false} />
									<YAxis
										stroke={AXIS_COLOR}
										tick={{ fill: AXIS_COLOR }}
										tickLine={false}
										axisLine={false}
										allowDecimals={false}
									/>
									<Tooltip cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} contentStyle={tooltipContentStyle} />
									<Area
										type="monotone"
										dataKey="count"
										name="Appointments"
										stroke="var(--primary)"
										strokeWidth={3}
										fillOpacity={1}
										fill="url(#appointmentGradient)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</Card>
				)}

				{activeTab === "ratings" && (
					<Card className="p-6">
						<h2 className="mb-5 border-b border-border pb-3 text-lg font-semibold text-foreground flex items-center gap-2">
							<Star className="h-5 w-5 text-primary fill-primary/10" /> Patient Ratings Trend (Monthly Average)
						</h2>
						{ratedBookings.length === 0 ? (
							<p className="py-12 text-center text-muted-foreground">No ratings received yet.</p>
						) : (
							<ResponsiveContainer width="100%" height={320}>
								<AreaChart data={monthlyRatingsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
									<defs>
										<linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
											<stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
										</linearGradient>
									</defs>
									<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
									<XAxis dataKey="month" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR }} tickLine={false} axisLine={false} />
									<YAxis
										domain={[1, 5]}
										ticks={[1, 2, 3, 4, 5]}
										stroke={AXIS_COLOR}
										tick={{ fill: AXIS_COLOR }}
										tickLine={false}
										axisLine={false}
									/>
									<Tooltip cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} contentStyle={tooltipContentStyle} />
									<Area
										type="monotone"
										dataKey="averageRating"
										name="Average Rating"
										stroke="var(--primary)"
										strokeWidth={3}
										fillOpacity={1}
										fill="url(#ratingGradient)"
										connectNulls={true}
									/>
								</AreaChart>
							</ResponsiveContainer>
						)}
					</Card>
				)}
			</div>
		</DashboardShell>
	);
}

export default DoctorAnalytics;
