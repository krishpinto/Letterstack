"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SectionsPanel() {
  return (
    <div className="flex flex-col overflow-auto">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Email Sections</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Create and edit your email structure, or insert pre-built sections.
          </p>
        </div>
        <Badge className="shrink-0 text-[10px]">New</Badge>
      </div>

      <Tabs defaultValue="manage">
        <TabsList className="h-9 w-full rounded-none border-b bg-transparent px-0">
          <TabsTrigger
            value="manage"
            className="flex-1 rounded-none border-b-2 border-transparent text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Manage
          </TabsTrigger>
          <TabsTrigger
            value="prebuilt"
            className="flex-1 rounded-none border-b-2 border-transparent text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Pre-built
          </TabsTrigger>
          <TabsTrigger
            value="saved"
            className="flex-1 rounded-none border-b-2 border-transparent text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="mt-0 px-2 py-2">
          <div className="flex flex-col gap-0.5">
            <SectionRow label="Header" />
            <SectionRow label="Body" />
            <SectionRow label="Footer" />
          </div>
          <button className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <span className="text-base font-light leading-none">+</span>
            Add blank section
          </button>
        </TabsContent>

        <TabsContent value="prebuilt" className="mt-0">
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Pre-built sections coming soon
          </p>
        </TabsContent>

        <TabsContent value="saved" className="mt-0">
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No saved sections yet
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionRow({ label }: { label: "Header" | "Body" | "Footer" }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent">
      <div className="flex h-8 w-10 shrink-0 flex-col justify-between rounded border border-border bg-muted p-1">
        {label === "Header" && (
          <>
            <div className="h-2 w-full rounded-sm bg-muted-foreground/40" />
            <div className="h-1 w-3/4 rounded-sm bg-muted-foreground/20" />
          </>
        )}
        {label === "Body" && (
          <>
            <div className="h-1 w-full rounded-sm bg-muted-foreground/20" />
            <div className="h-1 w-5/6 rounded-sm bg-muted-foreground/20" />
            <div className="h-1 w-4/6 rounded-sm bg-muted-foreground/20" />
          </>
        )}
        {label === "Footer" && (
          <>
            <div className="h-1 w-3/4 rounded-sm bg-muted-foreground/20" />
            <div className="h-2 w-full rounded-sm bg-muted-foreground/40" />
          </>
        )}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
