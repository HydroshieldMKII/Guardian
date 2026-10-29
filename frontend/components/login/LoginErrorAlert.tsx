import { AlertCircle } from "lucide-react";

export function LoginErrorAlert({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-600 dark:text-red-500">{message}</p>
    </div>
  );
}
