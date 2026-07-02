"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CheckIcon,
  Layers2Icon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";

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
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type OrgType = "personal" | "business";

const orgTypeCopy: Record<
  OrgType,
  { label: string; description: string; icon: typeof UserRoundIcon }
> = {
  personal: {
    label: "Personal",
    description: "For solo newsletters, creators, and experiments.",
    icon: UserRoundIcon,
  },
  business: {
    label: "Business",
    description: "For teams, companies, and client-facing campaigns.",
    icon: BriefcaseBusinessIcon,
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [orgType, setOrgType] = useState<OrgType>("business");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, type: orgType }),
      });
      const data = await response.json();

      if (!data.ok) {
        setError(data.error || "Could not create organization.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-svh bg-muted/20 p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-6xl flex-col gap-6 md:min-h-[calc(100svh-4rem)]">
        <Link href="/" className="flex w-fit items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers2Icon className="size-4" />
          </span>
          <span className="font-semibold tracking-normal">LetterStack</span>
        </Link>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="self-center">
            <CardHeader>
              <CardTitle>Set up your first organization</CardTitle>
              <CardDescription>
                This workspace becomes the home for templates, recipients,
                domains, and campaign settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Organization type</FieldLabel>
                    <ToggleGroup
                      type="single"
                      value={orgType}
                      onValueChange={(value) => {
                        if (value) setOrgType(value as OrgType);
                      }}
                      variant="outline"
                      className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      {(Object.keys(orgTypeCopy) as OrgType[]).map((key) => {
                        const Icon = orgTypeCopy[key].icon;

                        return (
                          <ToggleGroupItem
                            key={key}
                            value={key}
                            className="h-auto justify-start rounded-xl p-4 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/5"
                          >
                            <span className="flex items-start gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                <Icon className="size-4" />
                              </span>
                              <span className="flex flex-col gap-1">
                                <span className="font-medium">
                                  {orgTypeCopy[key].label}
                                </span>
                                <span className="text-xs leading-5 text-muted-foreground">
                                  {orgTypeCopy[key].description}
                                </span>
                              </span>
                            </span>
                          </ToggleGroupItem>
                        );
                      })}
                    </ToggleGroup>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="org-name">
                      Organization name
                    </FieldLabel>
                    <Input
                      id="org-name"
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      placeholder="Acme Studio"
                      required
                    />
                  </Field>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Field>
                    <Button
                      className="w-full sm:w-fit"
                      disabled={loading || !orgName.trim()}
                    >
                      {loading && <Spinner data-icon="inline-start" />}
                      {loading ? "Creating..." : "Create organization"}
                      {!loading && <ArrowRightIcon data-icon="inline-end" />}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <aside className="self-center rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SparklesIcon className="size-4" />
              </span>
              <div>
                <div className="font-medium">Workspace preview</div>
                <div className="text-xs text-muted-foreground">
                  {orgTypeCopy[orgType].label} organization
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {[
                "Create reusable templates",
                "Import or collect recipients",
                "Connect sender domains later",
                "Track campaign progress",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckIcon className="size-3" />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
