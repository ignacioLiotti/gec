"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html>
			<body>
				<div className="flex min-h-screen flex-col items-center justify-center p-4">
					<h1 className="text-2xl font-bold mb-4">Something went wrong!</h1>
					<p className="text-gray-600 mb-4">
						An unexpected error occurred. Our team has been notified.
					</p>
					<button
						onClick={() => reset()}
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
