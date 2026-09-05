import { useState, useEffect } from "react";
import { ReceiptText, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { authFetch } from "../../../utils/authFetch";
import { BACKEND_URL } from "../../../config";

const Transactions = ({ doctorId }) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [orders, setOrders] = useState([]);
	const [loadingOrders, setLoadingOrders] = useState(true);
	const [doctorBookings, setDoctorBookings] = useState([]);
	const [loadingBookings, setLoadingBookings] = useState(true);
	const [transactions, setTransactions] = useState([]);

	useEffect(() => {
		const fetchOrders = async () => {
			try {
				const token = localStorage.getItem("token");
				const res = await authFetch(`${BACKEND_URL}/api/orders/getOrdersByBuyerId/${doctorId}`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!res.ok) {
					if (res.status === 404) {
						setOrders([]);
						return;
					}
					throw new Error("Failed to fetch doctor orders");
				}

				const data = await res.json();
				setOrders(data.orders || []);
			} catch (error) {
				console.error("Error fetching doctor orders:", error);
			} finally {
				setLoadingOrders(false);
			}
		};

		if (doctorId) fetchOrders();
	}, [doctorId]);

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
				setDoctorBookings(data.bookings || []);
			} catch (error) {
				console.error("Error fetching doctor bookings:", error);
			} finally {
				setLoadingBookings(false);
			}
		};

		if (doctorId) fetchDoctorBookings();
	}, [doctorId]);

	const mapBookingsToTransactions = (bookings) => {
		return bookings.map((b) => ({
			id: b._id,
			date: b.dateOfAppointment || b.createdAt,
			patient: b.patientName,
			description: `Consultation with ${b.patientName} (${b.patientIllness})`,
			amount: b.amountPaid,
			type: "consultation",
		}));
	};

	const mapOrdersToTransactions = (orders) => {
		return orders.map((o) => ({
			id: o._id,
			date: o.createdAt,
			patient: `${o.retailers.length > 0 ? o.retailers.join(", ") : "Pharmacy"}`,
			description: `Medicine order (${o.items?.length || 0} items, ${o.orderStatus})`,
			amount: o.totalPrice,
			type: "medicine",
		}));
	};

	useEffect(() => {
		if (!loadingBookings && !loadingOrders) {
			const allTransactions = [...mapBookingsToTransactions(doctorBookings), ...mapOrdersToTransactions(orders)];

			allTransactions.forEach((t) => {
				t.dateObj = new Date(t.date);
			});

			allTransactions.sort((a, b) => b.dateObj - a.dateObj);
			setTransactions(allTransactions);
		}
	}, [doctorBookings, orders, loadingBookings, loadingOrders]);

	const filteredTransactions = transactions.filter((t) => {
		const term = searchTerm.toLowerCase();
		return (
			t.patient?.toLowerCase().includes(term) ||
			t.amount?.toString().includes(term) ||
			t.id?.toLowerCase().includes(term) ||
			t.type?.toLowerCase().includes(term)
		);
	});

	return (
		<Card className="mt-5 p-6">
			<div className="mb-5 flex flex-wrap items-center justify-between gap-4">
				<h3 className="flex items-center gap-2 text-xl font-semibold text-foreground">
					<ReceiptText className="size-5" /> Transaction History
				</h3>
				<div className="flex w-full min-w-0 max-w-[350px] items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
					<Search className="size-4 shrink-0 text-muted-foreground" />
					<Input
						placeholder="Search by Patient, Amount, or ID..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="h-auto border-0 p-0 shadow-none focus-visible:ring-0"
					/>
				</div>
			</div>

			<div className="overflow-x-auto rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Transaction ID</TableHead>
							<TableHead>Date</TableHead>
							<TableHead>Patient</TableHead>
							<TableHead>Description</TableHead>
							<TableHead>Amount Paid</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredTransactions.length > 0 ? (
							filteredTransactions.map((t) => (
								<TableRow key={t.id}>
									<TableCell className="font-mono text-xs text-muted-foreground">{t.id}</TableCell>
									<TableCell>{formatDate(t.date)}</TableCell>
									<TableCell className="font-medium text-foreground">{t.patient || "N/A"}</TableCell>
									<TableCell>
										{t.description}{" "}
										<Badge variant="secondary" className="ml-2">
											{t.type === "consultation" ? "Consultation" : "Medicine"}
										</Badge>
									</TableCell>
									<TableCell className="font-semibold text-foreground">
										₹{t.amount?.toLocaleString("en-IN") || 0}
									</TableCell>
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={5} className="py-8 text-center italic text-muted-foreground">
									No transactions found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</Card>
	);
};

export default Transactions;
