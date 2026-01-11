"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { deleteClassificationAction } from "@/server/actions/classification-delete";

type Props = {
  classificationId: string;
  productName: string;
};

export function DeleteClassificationButton({ classificationId, productName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteClassificationAction(classificationId);
        setOpen(false);
        // Go back to the previous page or dashboard if on detail page
        if (window.location.pathname.includes("/classify/") && window.location.pathname !== "/classify") {
          // We're on a detail page, go back to classify list
          router.push("/classify");
        } else {
          // We're on the list page, just refresh
          router.refresh();
        }
      } catch (error) {
        console.error("Failed to delete classification:", error);
        alert(error instanceof Error ? error.message : "Failed to delete classification");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Classification</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the classification for{" "}
            <strong>{productName}</strong>? This action cannot be undone. This will also delete:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>The classification record</li>
              <li>Associated dossier (if any)</li>
              <li>Duty summary and risk flags</li>
              <li>The product (if this is its only classification)</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

