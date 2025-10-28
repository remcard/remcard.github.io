import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportFlashcardsDialogProps {
  setId: string;
  onSuccess: () => void;
}

const ImportFlashcardsDialog = ({ setId, onSuccess }: ImportFlashcardsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const parseFlashcards = (text: string) => {
    const lines = text.trim().split("\n");
    const flashcards: { term: string; definition: string }[] = [];

    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        const term = parts[0].trim();
        const definition = parts[1].trim();
        if (term && definition) {
          flashcards.push({ term, definition });
        }
      }
    }

    return flashcards;
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast.error("Please paste your flashcard data");
      return;
    }

    setIsImporting(true);

    try {
      const flashcards = parseFlashcards(importText);

      if (flashcards.length === 0) {
        toast.error("No valid flashcards found. Make sure each line has term and definition separated by a tab.");
        setIsImporting(false);
        return;
      }

      // Get the highest position in the set
      const { data: existingCards } = await supabase
        .from("flashcards")
        .select("position")
        .eq("set_id", setId)
        .order("position", { ascending: false })
        .limit(1);

      const startPosition = existingCards && existingCards.length > 0 
        ? existingCards[0].position + 1 
        : 0;

      // Insert flashcards with positions
      const cardsToInsert = flashcards.map((card, index) => ({
        set_id: setId,
        term: card.term,
        definition: card.definition,
        position: startPosition + index,
      }));

      const { error } = await supabase.from("flashcards").insert(cardsToInsert);

      if (error) throw error;

      toast.success(`Imported ${flashcards.length} flashcards!`);
      setOpen(false);
      setImportText("");
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to import flashcards");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Flashcards</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Paste your flashcards below. Each line should have the term and definition separated by a tab.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              <strong>Format:</strong> term[TAB]definition<br />
              <strong>Example:</strong> adhere[TAB]to believe in and follow the practices of
            </p>
            <Textarea
              placeholder="adhere	to believe in and follow the practices of
advocate	to recommend; to support
allude	to hint at"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? "Importing..." : "Import Flashcards"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportFlashcardsDialog;
