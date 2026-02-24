"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

const isVercelProduction =
	process.env.NODE_ENV === "production" &&
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		if (isVercelProduction) {
			Sentry.captureException(error);
		}
	}, [error]);

	return (
		<div className="flex min-h-[400px] flex-col items-center justify-center p-4">
			<h2 className="text-xl font-semibold mb-4">Something went wrong!</h2>
			<p className="text-gray-600 mb-4 text-center">
				An error occurred while loading this page.
			</p>
			<button
				onClick={() => reset()}
				className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
			>
				Try again
			</button>
		</div>
	);
}
