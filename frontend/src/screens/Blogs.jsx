import { useLocation } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";

function BlogScreen() {
	const location = useLocation();
	const { blog } = location.state || {};

	if (!blog) {
		return <p className="px-5 text-center text-lg text-muted-foreground">No blog selected</p>;
	}

	return (
		<div className="px-5 pb-10">
			<Card className="mx-auto max-w-200 gap-5 rounded-2xl px-6 py-6 text-center sm:px-15">
				<h1 className="font-display m-0 text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl">
					{blog.title}
				</h1>
				{blog.image && (
					<img src={blog.image} alt={blog.title} className="mx-auto h-auto w-full max-w-150 rounded-xl" />
				)}
				<p className="m-0 text-lg leading-relaxed text-foreground">{blog.description}</p>
				<p className="m-0 text-sm font-medium text-muted-foreground">
					Date Published: {formatDate(blog.date)}
				</p>
			</Card>
		</div>
	);
}

export default BlogScreen;
