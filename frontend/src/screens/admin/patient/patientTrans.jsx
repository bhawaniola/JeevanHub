import React, { useState, useEffect } from 'react';
import { ReceiptText, Search } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { authFetch } from '../../../utils/authFetch';
import { BACKEND_URL } from '../../../config';

const Transactions = ({ bookings, patientId }) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [patientOrders, setPatientOrders] = useState([]);
	const [transactions, setTransactions] = useState([]);

	useEffect(() => {
		const fetchPatientOrders = async () => {
			try {
				const res = await authFetch(
					`${BACKEND_URL}/api/patients/orders/${patientId}`,
					{
						headers: {
							Authorization: `Bearer ${localStorage.getItem("token")}`
						}
					}
				);

				if (!res.ok) {
					if (res.status === 404) {
						setPatientOrders([]);
						return;
					}
					throw new Error("Failed to fetch patient orders");
				}

				const data = await res.json();
				setPatientOrders(data);
			} catch (error) {
				console.error("❌ Error fetching patient orders:", error);
			}
		};

		if (patientId) fetchPatientOrders();
	}, [patientId]);

	const mapBookingsToTransactions = (bookings) => {
		return bookings.map((b) => ({
			id: b._id,
			date: b.dateOfAppointment || b.createdAt,
			doctor: b.doctorName,
			description: `Consultation with ${b.doctorName} (${b.patientIllness})`,
			amount: b.amountPaid,
			type: "consultation"
		}));
	};

	const mapOrdersToTransactions = (orders) => {
		return orders.map((o) => ({
			id: o._id,
			date: o.createdAt,
			doctor: `${o.retailers.map(r => r).join(", ")}`,
			description: `Medicine order (${o.items.length} items, ${o.orderStatus})`,
			amount: o.totalPrice,
			type: "medicine"
		}));
	};

	useEffect(() => {
		if (bookings && patientOrders) {
			const allTransactions = [
				...mapBookingsToTransactions(bookings),
				...mapOrdersToTransactions(patientOrders),
			];

			allTransactions.forEach(t => {
				t.dateObj = new Date(t.date);
			});

			allTransactions.sort((a, b) => b.dateObj - a.dateObj);

			setTransactions(allTransactions);
		}
	}, [bookings, patientOrders]);

	const filteredTransactions = transactions.filter((t) => {
		const term = searchTerm.toLowerCase();
		return (
			t.doctor.toLowerCase().includes(term) ||
			t.amount.toString().includes(term) ||
			t.id.toLowerCase().includes(term) ||
			t.type.toLowerCase().includes(term)
		);
	});

	return (
		<Card className="overflow-hidden py-0">
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-4 border-b border-border bg-secondary/50 px-6 py-5">
				<CardTitle className="flex items-center gap-2 font-display text-xl">
					<ReceiptText size={20} className="text-primary" /> Transaction History
				</CardTitle>
				<div className="relative flex items-center">
					<Search size={16} className="pointer-events-none absolute left-3.5 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search by Doctor, Amount, or ID..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="h-10 w-full rounded-(--jh-radius-pill) pl-11 sm:w-80"
					/>
				</div>
			</CardHeader>

			<CardContent className="px-0">
				<Table className="min-w-[700px]">
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="bg-secondary/40 px-6 py-3 text-xs font-semibold uppercase tracking-wide">Transaction ID</TableHead>
							<TableHead className="bg-secondary/40 px-6 py-3 text-xs font-semibold uppercase tracking-wide">Date</TableHead>
							<TableHead className="bg-secondary/40 px-6 py-3 text-xs font-semibold uppercase tracking-wide">Doctor</TableHead>
							<TableHead className="bg-secondary/40 px-6 py-3 text-xs font-semibold uppercase tracking-wide">Description</TableHead>
							<TableHead className="bg-secondary/40 px-6 py-3 text-xs font-semibold uppercase tracking-wide">Amount Paid</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredTransactions.length > 0 ? (
							filteredTransactions.map((t) => (
								<TableRow key={t.id} className="hover:bg-secondary/30">
									<TableCell className="px-6 py-3">
										<span className="inline-block max-w-[150px] truncate rounded-(--jh-radius-sm) bg-secondary px-2 py-1 font-mono text-[0.8125rem] text-muted-foreground">
											{t.id}
										</span>
									</TableCell>
									<TableCell className="px-6 py-3 text-foreground">{formatDate(t.date)}</TableCell>
									<TableCell className="px-6 py-3 font-semibold text-foreground">{t.doctor}</TableCell>
									<TableCell className="max-w-[300px] px-6 py-3 whitespace-normal text-foreground">
										<span className="mb-1 block">{t.description}</span>
										<Badge variant={t.type === "consultation" ? "default" : "success"} className="capitalize">
											{t.type === "consultation" ? "Consultation" : "Medicine"}
										</Badge>
									</TableCell>
									<TableCell className="px-6 py-3 font-bold text-primary">
										₹{t.amount.toLocaleString("en-IN")}
									</TableCell>
								</TableRow>
							))
						) : (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={5} className="bg-secondary/30 px-6 py-10 text-center italic text-muted-foreground">
									No transactions found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
};

export default Transactions;
