import { useContext, useState, useEffect } from "react";
import { Menu, X, Bell, LogOut, ShoppingCart } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import GlobalSearchBox from "@/components/layout/GlobalSearchBox";
import LocationPicker from "@/components/layout/LocationPicker";
import { exploreOptions as defaultExploreOptions } from "@/screens/publicNavigation";
import { AuthContext } from "@/context/AuthContext";
import { CartContext } from "@/context/CartContext";
import { BACKEND_URL } from "@/config";
import { authFetch } from "@/utils/authFetch";
import defaultProfilePic from "@/media/default-profile.png";
import logo from "@/media/logo2.png";

function NavigationLink({ item, onNavigate }) {
	return (
		<NavLink
			to={item.to}
			onClick={onNavigate}
			className={({ isActive }) =>
				`relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
					isActive
						? "bg-accent text-accent-foreground"
						: "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
				}`
			}
		>
			{item.label}
			{item.badge > 0 ? (
				<Badge variant="destructive" className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
					{item.badge}
				</Badge>
			) : null}
		</NavLink>
	);
}

// Shared dashboard navbar shell for the Doctor, Retailer, and Admin roles — one
// `navItems` array rendered once (desktop row + mobile disclosure), same
// Explore/search/location treatment as the public nav. Role files own their own
// data fetching (SSE badge counts, path-aware sublinks) and pass the result in.
function DashboardNavbar({ navItems, profileTo, notificationsTo, cartTo, logoTo = "/", exploreOptions = defaultExploreOptions }) {
	const [showMenu, setShowMenu] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const { auth, logout } = useContext(AuthContext);
	const { cartCount } = useContext(CartContext);
	const savedLocation = auth.user?.address || auth.user?.zipCode;
	const navigate = useNavigate();

	useEffect(() => {
		if (!auth?.token || !notificationsTo) {
			setUnreadCount(0);
			return;
		}

		let isMounted = true;
		const fetchUnreadCount = async () => {
			try {
				const res = await authFetch(`${BACKEND_URL}/api/notifications`);
				if (res.ok) {
					const data = await res.json();
					if (isMounted && Array.isArray(data)) {
						const unread = data.filter((n) => !n.isRead).length;
						setUnreadCount(unread);
					}
				}
			} catch {
				// silent error
			}
		};

		fetchUnreadCount();

		const interval = setInterval(fetchUnreadCount, 30000);
		const handleRefresh = () => fetchUnreadCount();

		window.addEventListener("notifications:updated", handleRefresh);
		window.addEventListener("focus", handleRefresh);

		return () => {
			isMounted = false;
			clearInterval(interval);
			window.removeEventListener("notifications:updated", handleRefresh);
			window.removeEventListener("focus", handleRefresh);
		};
	}, [auth?.token, notificationsTo]);

	const userName = auth.user ? `${auth.user.firstName || ""} ${auth.user.lastName || ""}`.trim() : "Guest";
	const profileImage = auth.user?.profileImage || defaultProfilePic;

	const handleSignOut = () => {
		logout();
		navigate("/signin");
	};

	return (
		<header className="fixed inset-x-0 top-0 z-50 border-b border-primary-foreground/10 bg-primary text-primary-foreground shadow-(--jh-shadow-rest)">
			<div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
				<NavLink to={logoTo} className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
					<img src={logo} alt="JeevanHub" className="size-11 rounded-xl bg-primary-foreground/10 object-contain p-1" />
					<span className="hidden font-display text-xl font-semibold tracking-tight sm:inline">JeevanHub</span>
				</NavLink>

				<div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
					<GlobalSearchBox exploreOptions={exploreOptions} className="w-full max-w-xl" />
				</div>

				<div className="ml-auto flex items-center gap-2">
					<LocationPicker savedLocation={savedLocation} className="hidden xl:flex" />

					{cartTo ? (
						<NavLink to={cartTo} aria-label="Cart" className="relative hidden rounded-md p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground sm:inline-flex">
							<ShoppingCart className="size-5" aria-hidden="true" />
							{cartCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white shadow-sm select-none">
									{cartCount}
								</span>
							)}
						</NavLink>
					) : null}

					{notificationsTo ? (
						<NavLink to={notificationsTo} aria-label="Notifications" className="relative hidden rounded-md p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground sm:inline-flex">
							<Bell className="size-5" aria-hidden="true" />
							{unreadCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white shadow-sm select-none">
									{unreadCount > 99 ? "99+" : unreadCount}
								</span>
							)}
						</NavLink>
					) : null}

					<button
						type="button"
						onClick={() => navigate(profileTo)}
						className="hidden items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-primary-foreground/10 sm:flex"
					>
						<Avatar size="sm">
							<AvatarImage src={profileImage} alt="" />
							<AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">{userName.charAt(0)}</AvatarFallback>
						</Avatar>
						<span className="max-w-32 truncate text-sm font-semibold">{userName}</span>
					</button>

					<Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut} className="hidden text-primary-foreground hover:bg-primary-foreground/10 sm:inline-flex">
						<LogOut className="size-4" />
					</Button>

					<NavLink to={profileTo} aria-label="Profile" className="sm:hidden">
						<Avatar size="sm">
							<AvatarImage src={profileImage} alt="" />
							<AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">{userName.charAt(0)}</AvatarFallback>
						</Avatar>
					</NavLink>

					<Button variant="ghost" size="icon" aria-label={showMenu ? "Close navigation menu" : "Open navigation menu"} aria-expanded={showMenu} onClick={() => setShowMenu((open) => !open)} className="text-primary-foreground hover:bg-primary-foreground/10 lg:hidden">
						{showMenu ? <X /> : <Menu />}
					</Button>
				</div>
			</div>

			<nav className="hidden border-t border-primary-foreground/10 lg:block" aria-label="Primary navigation">
				<div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 sm:px-6 lg:px-8">
					<div className="flex items-center gap-1">{navItems.map((item) => <NavigationLink key={item.to} item={item} />)}</div>
				</div>
			</nav>

			{showMenu ? (
				<div className="border-t border-primary-foreground/10 bg-primary px-4 pb-5 pt-3 lg:hidden">
					<nav className="grid gap-1" aria-label="Mobile navigation">{navItems.map((item) => <NavigationLink key={item.to} item={item} onNavigate={() => setShowMenu(false)} />)}</nav>
					<div className="mt-3 flex items-center justify-between border-t border-primary-foreground/10 pt-3">
						<NavLink to={profileTo} onClick={() => setShowMenu(false)} className="flex items-center gap-2 text-sm font-semibold">
							<Avatar size="sm">
								<AvatarImage src={profileImage} alt="" />
								<AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">{userName.charAt(0)}</AvatarFallback>
							</Avatar>
							{userName}
						</NavLink>
						<div className="flex items-center gap-1">
							{cartTo ? (
								<NavLink to={cartTo} aria-label="Cart" onClick={() => setShowMenu(false)} className="relative rounded-md p-2 text-primary-foreground/80 hover:bg-primary-foreground/10">
									<ShoppingCart className="size-5" aria-hidden="true" />
									{cartCount > 0 && (
										<span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white shadow-sm select-none">
											{cartCount}
										</span>
									)}
								</NavLink>
							) : null}
							{notificationsTo ? (
								<NavLink to={notificationsTo} aria-label="Notifications" onClick={() => setShowMenu(false)} className="relative rounded-md p-2 text-primary-foreground/80 hover:bg-primary-foreground/10">
									<Bell className="size-5" aria-hidden="true" />
									{unreadCount > 0 && (
										<span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white shadow-sm select-none">
											{unreadCount > 99 ? "99+" : unreadCount}
										</span>
									)}
								</NavLink>
							) : null}
							<Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut} className="text-primary-foreground hover:bg-primary-foreground/10">
								<LogOut className="size-4" />
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</header>
	);
}

export default DashboardNavbar;
