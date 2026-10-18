"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("[v0] Global Error:", error);
    console.error("[v0] Error Name:", error.name);
    console.error("[v0] Error Message:", error.message);
    console.error("[v0] Error Stack:", error.stack);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Application Error
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              A critical error occurred. Please try again.
            </p>
          </div>

          {/* Show error details */}
          <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-auto max-h-40">
            <p className="text-red-600 font-semibold mb-1">
              {error.name}: {error.message}
            </p>
            {error.stack && (
              <pre className="text-gray-500 whitespace-pre-wrap break-words text-[10px]">
                {error.stack.split('\n').slice(0, 5).join('\n')}
              </pre>
            )}
            {error.digest && (
              <p className="text-gray-400 mt-2">Digest: {error.digest}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-2 px-4 bg-green-800 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = "/login"}
              className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium"
            >
              Back to Login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
