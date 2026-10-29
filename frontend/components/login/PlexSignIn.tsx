import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlexLogo } from "@/components/ui/plex-logo";

export function PlexSignIn({
  loading,
  waiting,
  disabled,
  onStart,
  onCancel,
}: {
  loading: boolean;
  waiting: boolean;
  disabled: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onStart}
        className="w-full !bg-[#e5a00d] hover:!bg-[#cc8f0c] !text-black !border-[#e5a00d] hover:!border-[#cc8f0c]"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Waiting for Plex...
          </>
        ) : (
          <>
            <PlexLogo className="mr-2 h-5 w-5" />
            Sign in with Plex
          </>
        )}
      </Button>

      {waiting && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Finish signing in on the Plex window, or{" "}
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer underline underline-offset-2 hover:text-foreground"
          >
            cancel
          </button>
          .
        </p>
      )}
    </>
  );
}
