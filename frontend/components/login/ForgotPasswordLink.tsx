import Link from "next/link";

export function ForgotPasswordLink() {
  return (
    <div className="text-right">
      <Link
        href="/forgot-password"
        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Forgot password?
      </Link>
    </div>
  );
}
