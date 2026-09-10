import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shareAuthorizationUrl } from "@/lib/shares";

interface RepoAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoOwner?: string;
  repoName?: string;
  defaultBranch?: string;
  variant?: "not-found" | "rate-limit" | "rate-limit-wait";
}

export function RepoAccessDialog({
  open,
  onOpenChange,
  repoOwner = "",
  repoName = "",
  variant = "not-found",
}: RepoAccessDialogProps) {
  const waiting = variant === "rate-limit" || variant === "rate-limit-wait";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{waiting ? "GitHub rate limit reached" : "Repository unavailable"}</DialogTitle>
          <DialogDescription>
            {waiting
              ? "Wait for GitHub's API rate limit to reset, then try again. Public repositories do not require sign-in or a share link."
              : "GitHub could not return this repository. Check its owner and name. If it is private, ask a repository administrator for a share link."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!waiting && (
            <Button onClick={() => window.location.assign(shareAuthorizationUrl(repoOwner, repoName))}>
              <Github />
              Create a private share link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
