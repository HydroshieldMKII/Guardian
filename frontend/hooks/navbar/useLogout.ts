import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  return async () => {
    try {
      await logout();
      toast({
        title: "Signed out",
        description: "You have been signed out",
        variant: "success",
      });
      router.push("/login");
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };
}
