import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/device-management/SharedComponents";
import type { UserPreference } from "@/types";

export function HiddenUsersDialog({
  open,
  onOpenChange,
  users,
  loading,
  onShow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserPreference[];
  loading: boolean;
  onShow: (userId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <EyeOff className="w-5 h-5 mr-2" />
            Hidden users
          </DialogTitle>
          <DialogDescription>
            These users are hidden from the main list. Click &quot;Show&quot; to
            make them visible again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Loading hidden users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hidden users found</p>
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    userId={user.userId}
                    username={user.username}
                    avatarUrl={user.avatarUrl}
                  />
                  <div>
                    <p className="font-medium">
                      {user.username || "Unknown username"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onShow(user.userId)}
                  className="ml-4"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Show
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HideUserDialog({
  username,
  onCancel,
  onConfirm,
}: {
  username: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={username !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <EyeOff className="w-5 h-5 mr-2" />
            Hide user?
          </DialogTitle>
          <DialogDescription className="pt-2">
            Are you sure you want to hide{" "}
            <span className="font-semibold text-foreground">{username}</span>{" "}
            from the user list?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <p className="text-muted-foreground">
              You can show them again from &quot;Hidden users&quot; at the
              bottom of the user list.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} className="w-full sm:w-auto">
            <EyeOff className="w-4 h-4 mr-2" />
            Hide user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
