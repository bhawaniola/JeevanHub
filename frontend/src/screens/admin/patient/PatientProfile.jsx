import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import PatientTrans from "./patientTrans";
import PatientFeedback from "./PatientFeedback";
import PatientHistory from "./PatientHistory";
import DietPlan from "./DietPlan";
import Prescription from "./Prescription";
import { authFetch } from "../../../utils/authFetch";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

import {
	Pill,
	Apple,
	History,
	IndianRupee,
	MessageSquareText,
	Mail,
	Phone,
	MapPin,
	Upload,
	User,
	CalendarDays,
	ArrowLeft,
} from "lucide-react";
import { BACKEND_URL } from '../../../config';

const tabs = [
	{ name: "Prescriptions", icon: Pill },
	{ name: "Diet Plan", icon: Apple },
	{ name: "History", icon: History },
	{ name: "Transactions", icon: IndianRupee },
	{ name: "Feedback", icon: MessageSquareText },
];

const GENDER_OPTIONS = [
	{ value: "male", label: "Male" },
	{ value: "female", label: "Female" },
	{ value: "other", label: "Other" },
	{ value: "prefer-not-to-say", label: "Prefer not to say" },
];

function formatDOB(dobString) {
	const date = new Date(dobString);
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();
	return `${day}-${month}-${year}`;
}

function formatDOB2(dobString) {
	const date = new Date(dobString);
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const year = date.getFullYear();
	return `${year}-${month}-${day}`;
}

function EditProfileDialog({ open, onOpenChange, currentProfile, onUpdate }) {
	const [formData, setFormData] = useState(currentProfile);
	const [previewImage, setPreviewImage] = useState(currentProfile.profileImage || null);
	const fileInputRef = useRef(null);

	useEffect(() => {
		if (open) {
			setFormData(currentProfile);
			setPreviewImage(currentProfile.profileImage || null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleImageUpload = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > 100 * 1024) {
			alert("Image must be less than 500KB");
			return;
		}

		if (!file.type.startsWith("image/")) {
			alert("Only image files allowed");
			return;
		}

		const reader = new FileReader();
		reader.onloadend = () => {
			const result = reader.result;
			setPreviewImage(result);
			setFormData((prev) => ({ ...prev, profileImage: result }));
		};
		reader.readAsDataURL(file);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const success = await onUpdate(formData);
		if (success) onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="text-2xl">Update Profile</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6 overflow-y-auto">
					<div className="flex flex-col items-center gap-4 rounded-(--jh-radius-md) bg-secondary p-6">
						<Avatar size="lg" className="size-28 border-4 border-primary shadow-(--jh-shadow-card)">
							<AvatarImage src={previewImage} alt="Profile preview" />
							<AvatarFallback className="bg-muted text-muted-foreground">
								<User size={40} />
							</AvatarFallback>
						</Avatar>
						<Button type="button" onClick={() => fileInputRef.current?.click()}>
							<Upload size={16} data-icon="inline-start" />
							Upload Photo
						</Button>
						<input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
					</div>

					<FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="firstName">First Name *</FieldLabel>
							<Input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
						</Field>

						<Field>
							<FieldLabel htmlFor="lastName">Last Name *</FieldLabel>
							<Input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
						</Field>

						<Field>
							<FieldLabel htmlFor="email">Email *</FieldLabel>
							<Input id="email" type="email" name="email" value={formData.email} onChange={handleInputChange} required />
						</Field>

						<Field>
							<FieldLabel htmlFor="dob">Date of Birth *</FieldLabel>
							<Input id="dob" type="date" name="dob" value={formData.dob} onChange={handleInputChange} required />
						</Field>

						<Field>
							<FieldLabel htmlFor="gender">Gender *</FieldLabel>
							<Select value={formData.gender} onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))} items={GENDER_OPTIONS}>
								<SelectTrigger id="gender">
									<SelectValue placeholder="Select gender" />
								</SelectTrigger>
								<SelectContent>
									{GENDER_OPTIONS.map((g) => (
										<SelectItem key={g.value} value={g.value}>
											{g.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="pincode">Pincode *</FieldLabel>
							<Input id="pincode" name="pincode" value={formData.pincode} onChange={handleInputChange} pattern="[0-9]{6}" maxLength={6} required />
						</Field>

						<Field className="sm:col-span-2">
							<FieldLabel htmlFor="address">Address *</FieldLabel>
							<Textarea id="address" name="address" value={formData.address} onChange={handleInputChange} rows={3} required />
						</Field>
					</FieldGroup>

					<div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit">Save Changes</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const PatientProfile = () => {
	const { id: patientId } = useParams();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("Diet Plan");
	const [patientData, setPatientData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [patientBookings, setPatientBookings] = useState([]);
	const [showEditModal, setShowEditModal] = useState(false);

	useEffect(() => {
		const fetchPatientBookings = async () => {
			try {
				const res = await authFetch(
					`${BACKEND_URL}/api/bookings/patient/${patientId}`,
					{ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
				);

				if (!res.ok) {
					if (res.status === 404) {
						setPatientBookings([]);
						return;
					}
					throw new Error("Failed to fetch patient bookings");
				}

				const data = await res.json();
				setPatientBookings(data.bookings);
			} catch (error) {
				console.error("❌ Error fetching patient bookings:", error);
			}
		};

		if (patientId) fetchPatientBookings();
	}, [patientId]);

	useEffect(() => {
		const fetchPatient = async () => {
			try {
				const res = await authFetch(`${BACKEND_URL}/api/patients/getPatient/${patientId}`, {
					headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
				});
				if (!res.ok) throw new Error("Failed to fetch patient");
				const data = await res.json();
				setPatientData(data);
			} catch (error) {
				console.error("Error fetching patients:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchPatient();
	}, [patientId]);

	const handleUpdateProfile = async (updatedData) => {
		try {
			const res = await authFetch(
				`${BACKEND_URL}/api/patients/updatePatient/${patientId}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`
					},
					body: JSON.stringify(updatedData),
				}
			);

			const data = await res.json();

			if (res.ok && data.success) {
				setPatientData(data.data);
				return true;
			}
			alert("Failed to update profile. Please try again.");
			return false;
		} catch (error) {
			console.error("Error updating profile:", error);
			alert("An error occurred while updating the profile. Please try again.");
			return false;
		}
	};

	if (loading) {
		return (
			<div className="mx-auto max-w-7xl p-8">
				<Skeleton className="h-64 w-full rounded-(--jh-radius-lg)" />
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1550px] p-4 sm:p-6 lg:p-8">
			{showEditModal && patientData && (
				<EditProfileDialog
					open={showEditModal}
					onOpenChange={setShowEditModal}
					onUpdate={handleUpdateProfile}
					currentProfile={{
						firstName: patientData.firstName,
						lastName: patientData.lastName,
						email: patientData.email,
						dob: formatDOB2(patientData.dob),
						gender: patientData.gender,
						address: patientData.address || "",
						pincode: patientData.zipCode,
						profileImage: patientData.profileImage || null,
					}}
				/>
			)}

			<Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 text-muted-foreground hover:text-foreground">
				<ArrowLeft size={16} data-icon="inline-start" />
				Back to Patients
			</Button>

			<h1 className="font-display text-3xl text-foreground sm:text-4xl">Patient Dashboard</h1>
			<p className="mt-2 mb-8 text-muted-foreground">Complete medical and dietary information</p>

			<div className="flex flex-col overflow-hidden rounded-(--jh-radius-lg) border border-border bg-card shadow-(--jh-shadow-card) lg:flex-row">
				<div className="flex shrink-0 flex-col items-center border-b border-border bg-secondary/50 p-8 text-center lg:w-80 lg:border-b-0 lg:border-r">
					<Avatar size="lg" className="size-20 bg-primary text-3xl font-semibold text-primary-foreground">
						<AvatarImage src={patientData.profileImage} alt="Profile" />
						<AvatarFallback className="bg-primary text-3xl font-semibold text-primary-foreground">
							{patientData.firstName.charAt(0)}
						</AvatarFallback>
					</Avatar>

					<Button variant="outline" size="sm" className="mt-4" onClick={() => setShowEditModal(true)}>
						Edit
					</Button>

					<h2 className="mt-4 font-display text-2xl text-foreground">{patientData.firstName}</h2>
					<p className="mb-6 text-sm text-muted-foreground">Patient ID: {patientData._id}</p>

					<Separator className="w-full" />

					<div className="mt-6 flex w-full flex-col gap-3 text-left">
						<p className="flex items-start gap-2 text-sm text-foreground"><Mail size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {patientData.email}</p>
						<p className="flex items-start gap-2 text-sm text-foreground"><Phone size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {patientData.phone}</p>
						<p className="flex items-start gap-2 text-sm text-foreground"><MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {patientData.zipCode}</p>
						<p className="flex items-start gap-2 text-sm text-foreground"><CalendarDays size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> DOB: {formatDOB(patientData.dob)}</p>
					</div>

					<div className="mt-6 flex w-full justify-around">
						<div>
							<p className="text-2xl font-semibold text-foreground">{patientData.age}</p>
							<p className="mt-1 text-sm text-muted-foreground">Age</p>
						</div>
						<div>
							<p className="text-2xl font-semibold capitalize text-foreground">{patientData.gender}</p>
							<p className="mt-1 text-sm text-muted-foreground">Gender</p>
						</div>
					</div>
				</div>

				<div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="mb-6 h-auto flex-wrap bg-secondary p-1">
							{tabs.map((tab) => (
								<TabsTrigger key={tab.name} value={tab.name} className="gap-2 py-2.5 text-sm font-semibold">
									<tab.icon data-icon="inline-start" strokeWidth={2.5} />
									{tab.name}
								</TabsTrigger>
							))}
						</TabsList>

						<TabsContent value="Prescriptions" className="min-w-0">
							<Prescription patientBookings={patientBookings} />
						</TabsContent>
						<TabsContent value="Diet Plan" className="min-w-0">
							<DietPlan patientId={patientId} />
						</TabsContent>
						<TabsContent value="History" className="min-w-0">
							<PatientHistory bookings={patientBookings} />
						</TabsContent>
						<TabsContent value="Transactions" className="min-w-0">
							<PatientTrans bookings={patientBookings} patientId={patientId} />
						</TabsContent>
						<TabsContent value="Feedback" className="min-w-0">
							<PatientFeedback patientId={patientId} />
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
};

export default PatientProfile;
