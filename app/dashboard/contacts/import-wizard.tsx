"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CheckCircle2Icon, FileSpreadsheetIcon, UploadIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Summary = {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  suppressed: number;
};

type Parsed = { headers: string[]; rows: string[][]; fileName: string };

function norm(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessColumn(headers: string[], kind: "email" | "name"): number {
  const normed = headers.map(norm);
  if (kind === "email") {
    const exact = normed.findIndex(
      (header) =>
        header === "email" ||
        header === "emailaddress" ||
        header === "emailid",
    );
    if (exact >= 0) return exact;
    return normed.findIndex(
      (header) => header.includes("email") || header.includes("mail"),
    );
  }

  const exact = normed.findIndex(
    (header) => header === "name" || header === "fullname",
  );
  if (exact >= 0) return exact;
  return normed.findIndex((header) => header.includes("name"));
}

export function ImportWizard({
  endpoint = "/api/audience/import",
  onClose,
  onDone,
}: {
  endpoint?: string;
  onClose: () => void;
  onDone: (summary: Summary) => void;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [emailCol, setEmailCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [parseError, setParseError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function ingest(headers: string[], rows: string[][], fileName: string) {
    const clean = headers.map((header) => (header ?? "").toString().trim());
    setParsed({ headers: clean, rows, fileName });
    setEmailCol(guessColumn(clean, "email"));
    setNameCol(guessColumn(clean, "name"));
    setParseError(null);
  }

  function onFile(file: File) {
    setParseError(null);
    const isCsv = /\.csv$/i.test(file.name);

    if (isCsv) {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (result) => {
          const all = result.data as unknown as string[][];
          if (all.length < 2) {
            setParseError("That file has no data rows.");
            return;
          }
          ingest(all[0], all.slice(1), file.name);
        },
        error: () => setParseError("Could not read that CSV."),
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const all = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          blankrows: false,
          defval: "",
        });
        if (all.length < 2) {
          setParseError("That sheet has no data rows.");
          return;
        }
        ingest(
          all[0].map(String),
          all.slice(1).map((row) => row.map(String)),
          file.name,
        );
      } catch {
        setParseError("Could not read that spreadsheet.");
      }
    };
    reader.onerror = () => setParseError("Could not read that file.");
    reader.readAsArrayBuffer(file);
  }

  const contacts = useMemo(() => {
    if (!parsed || emailCol < 0) return [];
    return parsed.rows
      .map((row) => ({
        email: (row[emailCol] ?? "").toString().trim(),
        name: nameCol >= 0 ? (row[nameCol] ?? "").toString().trim() : "",
      }))
      .filter((contact) => contact.email);
  }, [parsed, emailCol, nameCol]);

  async function commit() {
    setCommitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      }).then((result) => result.json());

      if (response.ok) setSummary(response.summary);
      else setParseError(response.error || "Import failed");
    } catch {
      setParseError("Could not reach the server.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {summary
              ? "Import complete"
              : parsed
                ? "Map your columns"
                : "Import contacts"}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file, map the email and name columns, then
            import the cleaned list.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <SummaryStep summary={summary} />
        ) : parsed ? (
          <MapStep
            parsed={parsed}
            emailCol={emailCol}
            nameCol={nameCol}
            contacts={contacts}
            parseError={parseError}
            committing={committing}
            setEmailCol={setEmailCol}
            setNameCol={setNameCol}
          />
        ) : (
          <UploadStep parseError={parseError} onFile={onFile} />
        )}

        <DialogFooter>
          {summary ? (
            <Button onClick={() => onDone(summary)}>
              <CheckCircle2Icon data-icon="inline-start" />
              Done
            </Button>
          ) : !parsed ? (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setParsed(null)}>
                Back
              </Button>
              <Button
                onClick={commit}
                disabled={committing || emailCol < 0 || contacts.length === 0}
              >
                {committing && <Spinner data-icon="inline-start" />}
                {committing ? "Importing..." : `Import ${contacts.length}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadStep({
  parseError,
  onFile,
}: {
  parseError: string | null;
  onFile: (file: File) => void;
}) {
  return (
    <FieldGroup className="gap-5">
      <label
        htmlFor="contacts-import-file"
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:bg-muted/50"
      >
        <span className="flex size-12 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
          <FileSpreadsheetIcon className="size-6" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-medium text-foreground">
            Choose a CSV or Excel file
          </span>
          <span className="text-sm text-muted-foreground">
            Columns are mapped in the next step.
          </span>
        </span>
        <Button type="button" variant="outline" asChild>
          <span>
            <UploadIcon data-icon="inline-start" />
            Browse file
          </span>
        </Button>
        <input
          id="contacts-import-file"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      </label>

      {parseError && (
        <Alert variant="destructive">
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}
    </FieldGroup>
  );
}

function MapStep({
  parsed,
  emailCol,
  nameCol,
  contacts,
  parseError,
  committing,
  setEmailCol,
  setNameCol,
}: {
  parsed: Parsed;
  emailCol: number;
  nameCol: number;
  contacts: { email: string; name: string }[];
  parseError: string | null;
  committing: boolean;
  setEmailCol: (value: number) => void;
  setNameCol: (value: number) => void;
}) {
  return (
    <FieldGroup className="gap-5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{parsed.fileName}</span> has{" "}
        {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Mapper
          label="Email column"
          required
          value={emailCol}
          headers={parsed.headers}
          onChange={setEmailCol}
        />
        <Mapper
          label="Name column (optional)"
          value={nameCol}
          headers={parsed.headers}
          onChange={setNameCol}
          allowNone
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.slice(0, 5).map((contact, index) => (
              <TableRow key={`${contact.email}-${index}`}>
                <TableCell className="max-w-64 truncate">{contact.email}</TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {contact.name || "-"}
                </TableCell>
              </TableRow>
            ))}
            {contacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="h-20 text-center text-muted-foreground">
                  No email values found in that column. Pick a different one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <FieldDescription>
        {contacts.length} row{contacts.length === 1 ? "" : "s"} with an email
        will be checked for duplicates, invalid syntax, and unsubscribes.
      </FieldDescription>

      {parseError && (
        <Alert variant="destructive">
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {committing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Importing contacts...
        </div>
      )}
    </FieldGroup>
  );
}

function Mapper({
  label,
  value,
  headers,
  onChange,
  required,
  allowNone,
}: {
  label: string;
  value: number;
  headers: string[];
  onChange: (value: number) => void;
  required?: boolean;
  allowNone?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={label}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <NativeSelect
        id={label}
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      >
        {allowNone && <NativeSelectOption value="-1">None</NativeSelectOption>}
        {!allowNone && value < 0 && (
          <NativeSelectOption value="-1">Select a column...</NativeSelectOption>
        )}
        {headers.map((header, index) => (
          <NativeSelectOption key={`${header}-${index}`} value={String(index)}>
            {header || `Column ${index + 1}`}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function SummaryStep({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={summary.imported} label="Imported" tone="primary" />
        <Stat n={summary.duplicates} label="Duplicates" tone="muted" />
        <Stat
          n={summary.invalid}
          label="Invalid"
          tone={summary.invalid ? "destructive" : "muted"}
        />
        <Stat n={summary.suppressed} label="Suppressed" tone="muted" />
      </div>
      <p className="text-sm text-muted-foreground">
        {summary.imported} new contact{summary.imported === 1 ? "" : "s"} added
        from {summary.received} row{summary.received === 1 ? "" : "s"}.
        Duplicates and suppressed addresses were skipped automatically.
      </p>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: "primary" | "muted" | "destructive";
}) {
  return (
    <Card size="sm">
      <CardHeader className="gap-1">
        <CardTitle
          className={cn(
            "text-2xl tabular-nums",
            tone === "primary" && "text-primary",
            tone === "muted" && "text-muted-foreground",
            tone === "destructive" && "text-destructive",
          )}
        >
          {n}
        </CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="hidden" />
    </Card>
  );
}
