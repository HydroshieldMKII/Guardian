import { AlertCircle } from "lucide-react";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="h-3 w-3" />
      {message}
    </div>
  );
}
