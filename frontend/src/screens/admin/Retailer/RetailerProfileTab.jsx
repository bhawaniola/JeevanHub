import { Briefcase, CheckCircle2, User, AtSign, Phone, MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";

const RetailerProfileTab = ({ retailer }) => {
	if (!retailer) {
		return <p className="mt-4 text-center text-muted-foreground">Retailer data is not available.</p>;
	}

	const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

	const businessRows = [
		{ label: "Business Name", value: retailer.BusinessName },
		{ label: "License Number", value: retailer.licenseNumber },
		{ label: "Date of Birth", value: formatDate(retailer.dob) },
	];

	const contactRows = [
		{ label: "Email", icon: AtSign, value: retailer.email },
		{ label: "Phone", icon: Phone, value: retailer.phone },
		{ label: "Address", icon: MapPin, value: retailer.zipCode },
	];

	return (
		<div className="mt-4 flex flex-wrap gap-6">
			<Card className="min-w-80 flex-1 p-7 transition-shadow hover:shadow-md">
				<h3 className="mb-6 flex items-center gap-3 border-b border-border pb-3 text-lg font-semibold text-foreground">
					<Briefcase className="size-5" /> Business Information
				</h3>
				<div className="divide-y divide-border">
					{businessRows.map((row) => (
						<div key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-3.5 text-sm">
							<span className="font-medium text-muted-foreground">{row.label}</span>
							<span className="text-right font-medium text-foreground">{row.value}</span>
						</div>
					))}
					<div className="flex flex-wrap items-center justify-between gap-2 py-3.5 text-sm">
						<span className="font-medium text-muted-foreground">Status</span>
						<Badge variant={retailer.status === "active" ? "default" : "secondary"} className="gap-1">
							<CheckCircle2 className="size-3.5" /> {capitalizeFirstLetter(retailer.status)}
						</Badge>
					</div>
				</div>
			</Card>

			<Card className="min-w-80 flex-1 p-7 transition-shadow hover:shadow-md">
				<h3 className="mb-6 flex items-center gap-3 border-b border-border pb-3 text-lg font-semibold text-foreground">
					<User className="size-5" /> Contact Information
				</h3>
				<div className="divide-y divide-border">
					{contactRows.map((row) => (
						<div key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-3.5 text-sm">
							<span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
								<row.icon className="size-3.5" /> {row.label}
							</span>
							<span className="text-right font-medium text-foreground">{row.value}</span>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
};

export default RetailerProfileTab;
