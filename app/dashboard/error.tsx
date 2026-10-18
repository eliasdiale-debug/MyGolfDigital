"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("[v0] Dashboard Error:", error);
    console.error("[v0] Error Name:", error.name);
    console.error("[v0] Error Message:", error.message);
    console.error("[v0] Error Stack:", error.stack);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f4ed] dark:bg-[#0a0f05] p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            We encountered an error loading the dashboard.
          </p>
        </div>

        {/* Show error details for debugging */}
        <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-auto max-h-40">
          <p className="text-red-600 dark:text-red-400 font-semibold mb-1">
            {error.name}: {error.message}
          </p>
          {error.stack && (
            <pre className="text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words text-[10px]">
              {error.stack.split('\n').slice(0, 5).join('\n')}
            </pre>
          )}
          {error.digest && (
            <p className="text-slate-400 mt-2">Digest: {error.digest}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={reset}
            className="flex-1 bg-[#1a3a2a] hover:bg-[#2d5a40] text-white"
          >
            Try Again
          </Button>
          <Button
            onClick={() => window.location.href = "/login"}
            variant="outline"
            className="flex-1"
          >
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
}
