"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  RotateCcwIcon,
  UploadIcon,
} from "lucide-react";

import { useAsyncData } from "@/components/data-state";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage, fetchJson } from "@/lib/fetch-json";
import {
  IMPORT_MAX_ROWS_PER_FILE,
  addImportSummary,
  chunkRows,
  describeStoppedImport,
  emptyImportSummary,
  importPercent,
  remainingAutomationBudget,
  type ImportSummary,
} from "@/lib/import/batches";
import { cn } from "@/lib/utils";

export type { ImportSummary };

const AUDIENCE_IMPORT_ENDPOINT = "/api/audience/import";
const NEW_FOLDER = "__new__";

type Parsed = { headers: string[]; rows: string[][]; fileName: string };
type Contact = { email: string; name: string };
type Folder = { id: string; name: string };

type ChunkResponse = {
  summary?: Partial<Record<keyof ImportSummary, unknown>>;
  automationsQueued?: unknown;
};

// One import of one file, sent in chunks (lib/import/batches.ts). `next` is
// the first chunk not yet saved, so Retry / Resume picks up there instead of
// sending the whole file again.
type ImportRun = {
  chunks: Contact[][];
  next: number;
  total: ImportSummary;
  automationsQueued: number;
  folderId: string | null;
  error: string | null;
};

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
  endpoint = AUDIENCE_IMPORT_ENDPOINT,
  showFolderPicker = endpoint === AUDIENCE_IMPORT_ENDPOINT,
  defaultFolderId,
  onClose,
  onDone,
}: {
  endpoint?: string;
  /** Offer "Add to folder". Only the audience import supports folders. */
  showFolderPicker?: boolean;
  /** Folder to preselect, e.g. the one the contacts page is filtered to. */
  defaultFolderId?: string;
  onClose: () => void;
  onDone: (summary: ImportSummary) => void;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [emailCol, setEmailCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [parseError, setParseError] = useState<string | null>(null);
  const [folderChoice, setFolderChoice] = useState(defaultFolderId ?? "");
  const [newFolderName, setNewFolderName] = useState("");
  const [run, setRun] = useState<ImportRun | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const stopRequested = useRef(false);

  // Sending is folder-first, so an import should land in a folder. The list
  // is read here rather than passed in, so every caller of the wizard gets it.
  const folders = useAsyncData<Folder[]>(async () => {
    if (!showFolderPicker) return [];
    const data = await fetchJson<{ categories?: Folder[] }>(
      "/api/audience/categories",
    );
    return (data.categories ?? []).map(({ id, name }) => ({ id, name }));
  }, [showFolderPicker]);

  // Once a chunk is saved, the mapping and folder are fixed for this run.
  const started = run !== null && run.next > 0;

  function ingest(headers: string[], rows: string[][], fileName: string) {
    const clean = headers.map((header) => (header ?? "").toString().trim());
    setParsed({ headers: clean, rows, fileName });
    setEmailCol(guessColumn(clean, "email"));
    setNameCol(guessColumn(clean, "name"));
    setParseError(null);
    setRun(null);
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

  const contacts = useMemo<Contact[]>(() => {
    if (!parsed || emailCol < 0) return [];
    return parsed.rows
      .map((row) => ({
        email: (row[emailCol] ?? "").toString().trim(),
        name: nameCol >= 0 ? (row[nameCol] ?? "").toString().trim() : "",
      }))
      .filter((contact) => contact.email);
  }, [parsed, emailCol, nameCol]);

  const tooMany = contacts.length > IMPORT_MAX_ROWS_PER_FILE;

  // A change before anything was saved starts the run over.
  function resetUnstartedRun() {
    if (run && run.next === 0) setRun(null);
  }

  async function resolveFolderId(): Promise<string | null> {
    if (!showFolderPicker || !folderChoice) return null;
    if (folderChoice !== NEW_FOLDER) return folderChoice;
    const name = newFolderName.trim();
    if (!name) throw new Error("Name the new folder, or choose an existing one.");
    const data = await fetchJson<{ category: Folder }>("/api/audience/categories", {
      method: "POST",
      json: { action: "create", name },
    });
    const created = { id: data.category.id, name: data.category.name };
    // Select it, so a retry reuses this folder instead of creating another.
    folders.setData((list) => [created, ...list]);
    setFolderChoice(created.id);
    setNewFolderName("");
    return created.id;
  }

  async function startOrResume() {
    if (importing || tooMany || contacts.length === 0) return;
    setImporting(true);
    setParseError(null);
    stopRequested.current = false;

    let current: ImportRun | null = run;
    try {
      if (!current) {
        const folderId = await resolveFolderId();
        current = {
          chunks: chunkRows(contacts),
          next: 0,
          total: emptyImportSummary(),
          automationsQueued: 0,
          folderId,
          error: null,
        };
      }
      current = { ...current, error: null };
      setRun(current);

      while (current.next < current.chunks.length) {
        const response: ChunkResponse = await fetchJson<ChunkResponse>(endpoint, {
          method: "POST",
          json: {
            contacts: current.chunks[current.next],
            categoryId: current.folderId ?? undefined,
            automationBudget: remainingAutomationBudget(current.automationsQueued),
          },
        });
        const queued = Number(response.automationsQueued ?? 0);
        current = {
          ...current,
          next: current.next + 1,
          total: addImportSummary(current.total, response.summary ?? {}),
          automationsQueued:
            current.automationsQueued + (Number.isFinite(queued) ? queued : 0),
        };
        setRun(current);
        if (stopRequested.current) break;
      }

      if (current.next >= current.chunks.length) setSummary(current.total);
    } catch (error) {
      const message = errorMessage(error, "Import failed. Try again.");
      if (current) setRun({ ...current, error: message });
      else setParseError(message); // the new folder could not be created
    } finally {
      setImporting(false);
    }
  }

  function close() {
    if (importing) {
      // Finish the chunk in flight, then pause. Closing mid-request would
      // leave nobody knowing whether that chunk was saved.
      stopRequested.current = true;
      return;
    }
    // Some chunks were saved: report them so the list behind refreshes.
    if (run && run.next > 0) onDone(run.total);
    else onClose();
  }

  const runFolderName =
    run?.folderId != null
      ? (folders.data?.find((folder) => folder.id === run.folderId)?.name ?? null)
      : null;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogPopup className="sm:max-w-2xl">
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

        <DialogPanel>
        {summary ? (
          <SummaryStep summary={summary} folderName={runFolderName} />
        ) : parsed ? (
          <MapStep
            parsed={parsed}
            emailCol={emailCol}
            nameCol={nameCol}
            contacts={contacts}
            tooMany={tooMany}
            parseError={parseError}
            locked={started || importing}
            setEmailCol={(value) => {
              setEmailCol(value);
              resetUnstartedRun();
            }}
            setNameCol={(value) => {
              setNameCol(value);
              resetUnstartedRun();
            }}
            folderPicker={
              showFolderPicker ? (
                <FolderPicker
                  folders={folders.data ?? []}
                  loading={folders.status === "loading"}
                  loadError={folders.status === "error" ? folders.error : null}
                  onRetryLoad={() => void folders.reload()}
                  value={folderChoice}
                  onChange={(value) => {
                    setFolderChoice(value);
                    resetUnstartedRun();
                  }}
                  newFolderName={newFolderName}
                  onNewFolderNameChange={setNewFolderName}
                  disabled={started || importing}
                />
              ) : null
            }
            progress={run ? <ImportProgress run={run} importing={importing} /> : null}
          />
        ) : (
          <UploadStep parseError={parseError} onFile={onFile} />
        )}
        </DialogPanel>

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
          ) : importing ? (
            <>
              <Button variant="outline" onClick={close}>
                Pause
              </Button>
              <Button disabled>
                <Spinner data-icon="inline-start" />
                Importing...
              </Button>
            </>
          ) : started ? (
            <>
              <Button variant="outline" onClick={close}>
                Close
              </Button>
              <Button onClick={startOrResume}>
                <RotateCcwIcon data-icon="inline-start" />
                {run?.error ? "Retry" : "Resume"} from batch {(run?.next ?? 0) + 1}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setParsed(null);
                  setRun(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={startOrResume}
                disabled={
                  emailCol < 0 ||
                  contacts.length === 0 ||
                  tooMany ||
                  (showFolderPicker &&
                    folderChoice === NEW_FOLDER &&
                    !newFolderName.trim())
                }
              >
                {run?.error
                  ? "Retry"
                  : `Import ${contacts.length.toLocaleString()}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
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
            Up to {IMPORT_MAX_ROWS_PER_FILE.toLocaleString()} rows. Columns are
            mapped in the next step.
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
  tooMany,
  parseError,
  locked,
  setEmailCol,
  setNameCol,
  folderPicker,
  progress,
}: {
  parsed: Parsed;
  emailCol: number;
  nameCol: number;
  contacts: Contact[];
  tooMany: boolean;
  parseError: string | null;
  /** True once the import has begun: the mapping can no longer change. */
  locked: boolean;
  setEmailCol: (value: number) => void;
  setNameCol: (value: number) => void;
  folderPicker: ReactNode;
  progress: ReactNode;
}) {
  return (
    <FieldGroup className="gap-5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{parsed.fileName}</span> has{" "}
        {parsed.rows.length.toLocaleString()} row
        {parsed.rows.length === 1 ? "" : "s"}.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Mapper
          label="Email column"
          required
          value={emailCol}
          headers={parsed.headers}
          onChange={setEmailCol}
          disabled={locked}
        />
        <Mapper
          label="Name column (optional)"
          value={nameCol}
          headers={parsed.headers}
          onChange={setNameCol}
          allowNone
          disabled={locked}
        />
      </div>

      {folderPicker}

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

      {tooMany ? (
        <Alert variant="destructive">
          <AlertDescription>
            This file has {contacts.length.toLocaleString()} rows with an email.
            One import takes up to {IMPORT_MAX_ROWS_PER_FILE.toLocaleString()}.
            Split the file and import each part.
          </AlertDescription>
        </Alert>
      ) : (
        <FieldDescription>
          {contacts.length.toLocaleString()} row{contacts.length === 1 ? "" : "s"}{" "}
          with an email will be checked for duplicates, invalid syntax, and
          unsubscribes.
        </FieldDescription>
      )}

      {parseError && (
        <Alert variant="destructive">
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {progress}
    </FieldGroup>
  );
}

function FolderPicker({
  folders,
  loading,
  loadError,
  onRetryLoad,
  value,
  onChange,
  newFolderName,
  onNewFolderNameChange,
  disabled,
}: {
  folders: Folder[];
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  value: string;
  onChange: (value: string) => void;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  disabled: boolean;
}) {
  // A preselected folder that isn't in the list (deleted, or still loading)
  // still shows as chosen rather than silently falling back to "No folder".
  const unknownChoice =
    value && value !== NEW_FOLDER && !folders.some((folder) => folder.id === value);

  return (
    <Field>
      <FieldLabel htmlFor="import-folder">Add to folder</FieldLabel>
      <NativeSelect
        id="import-folder"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full"
      >
        <NativeSelectOption value="">No folder</NativeSelectOption>
        {unknownChoice && (
          <NativeSelectOption value={value}>
            {loading ? "Loading folders…" : "Selected folder"}
          </NativeSelectOption>
        )}
        {folders.map((folder) => (
          <NativeSelectOption key={folder.id} value={folder.id}>
            {folder.name}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={NEW_FOLDER}>New folder…</NativeSelectOption>
      </NativeSelect>
      {value === NEW_FOLDER && (
        <Input
          value={newFolderName}
          onChange={(event) => onNewFolderNameChange(event.target.value)}
          placeholder="Folder name"
          aria-label="New folder name"
          disabled={disabled}
        />
      )}
      {loadError ? (
        <FieldDescription className="text-destructive">
          Couldn&apos;t load your folders: {loadError}{" "}
          <button
            type="button"
            onClick={onRetryLoad}
            className="cursor-pointer underline underline-offset-2"
          >
            Try again
          </button>
        </FieldDescription>
      ) : (
        <FieldDescription>
          Campaigns are sent to folders. Contacts already in your audience are
          added to the folder too.
        </FieldDescription>
      )}
    </Field>
  );
}

function ImportProgress({
  run,
  importing,
}: {
  run: ImportRun;
  importing: boolean;
}) {
  const count = run.chunks.length;
  const done = run.next >= count;
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {importing
            ? `Importing batch ${Math.min(run.next + 1, count)} of ${count}…`
            : done
              ? "All batches imported."
              : run.error
                ? `Stopped after ${run.next} of ${count} batches.`
                : `Paused after ${run.next} of ${count} batches.`}
        </span>
        <span className="tabular-nums">
          {run.total.imported.toLocaleString()} new so far
        </span>
      </div>
      <Progress
        value={importPercent(run.next, count)}
        className="h-1.5"
        aria-label="Import progress"
      />
      {run.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {describeStoppedImport(run.total, run.next, count)} {run.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Mapper({
  label,
  value,
  headers,
  onChange,
  required,
  allowNone,
  disabled,
}: {
  label: string;
  value: number;
  headers: string[];
  onChange: (value: number) => void;
  required?: boolean;
  allowNone?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
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

function SummaryStep({
  summary,
  folderName,
}: {
  summary: ImportSummary;
  folderName: string | null;
}) {
  const { deadDomain, disposable, roleFlagged, typos } = summary;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={summary.imported} label="Imported" tone="primary" />
        <Stat n={summary.duplicates} label="Duplicates" tone="muted" />
        <Stat
          n={summary.invalid}
          label="Invalid syntax"
          tone={summary.invalid ? "destructive" : "muted"}
        />
        <Stat
          n={deadDomain}
          label="Dead domain"
          tone={deadDomain ? "destructive" : "muted"}
        />
        <Stat
          n={disposable}
          label="Disposable"
          tone={disposable ? "destructive" : "muted"}
        />
        <Stat n={summary.suppressed} label="Suppressed" tone="muted" />
        <Stat n={roleFlagged} label="Role (kept)" tone="muted" />
        <Stat n={typos} label="Typos (kept)" tone="muted" />
      </div>
      <p className="text-sm text-muted-foreground">
        {summary.imported.toLocaleString()} new contact
        {summary.imported === 1 ? "" : "s"} added from{" "}
        {summary.received.toLocaleString()} row
        {summary.received === 1 ? "" : "s"}. Invalid, dead-domain, disposable,
        duplicate, and suppressed addresses were skipped automatically.
        {roleFlagged + typos > 0
          ? " Role addresses and likely typos were imported but flagged for you to review."
          : ""}
        {folderName
          ? ` ${summary.addedToFolder.toLocaleString()} contact${summary.addedToFolder === 1 ? " is" : "s are"} now in the folder “${folderName}”.`
          : ""}
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
          {n.toLocaleString()}
        </CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="hidden" />
    </Card>
  );
}
