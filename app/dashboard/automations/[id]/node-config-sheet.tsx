"use client";

// Right-hand configuration panel for the selected automation node. Purely
// controlled: reads the node from the flow, writes config patches back up.

import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  DELAY_UNITS,
  TRIGGER_EVENTS,
  type AddCategoryConfig,
  type AutomationNode,
  type AutomationNodeConfig,
  type ConditionConfig,
  type ConditionField,
  type ConditionOperator,
  type DelayConfig,
  type DelayUnit,
  type SendEmailConfig,
  type TriggerConfig,
  type TriggerEvent,
  type UpdateContactConfig,
} from "@/lib/automations/flow";

export type SenderOption = { label: string; email: string; disabled?: boolean };

export type NodeConfigSheetProps = {
  node: AutomationNode | null;
  templates: { id: string; name: string }[];
  senders: SenderOption[];
  categories: { id: string; name: string }[];
  onClose: () => void;
  onConfigChange: (nodeId: string, config: AutomationNodeConfig) => void;
  onRemove: (nodeId: string) => void;
};

const TITLES: Record<AutomationNode["type"], { title: string; description: string }> = {
  trigger: {
    title: "Trigger",
    description: "The event that starts this automation for a contact.",
  },
  send_email: {
    title: "Send email",
    description: "Send one of your saved templates to the contact.",
  },
  condition: {
    title: "Condition",
    description: "Split the flow: contacts matching go down True, the rest go down False.",
  },
  delay: {
    title: "Delay",
    description: "Pause the flow for this contact before the next step runs.",
  },
  update_contact: {
    title: "Update contact",
    description: "Change the contact's details in your audience.",
  },
  add_category: {
    title: "Add to category",
    description: "Tag the contact with one of your audience categories.",
  },
  delete_contact: {
    title: "Delete contact",
    description: "Remove the contact from your audience entirely.",
  },
};

export function NodeConfigSheet({
  node,
  templates,
  senders,
  categories,
  onClose,
  onConfigChange,
  onRemove,
}: NodeConfigSheetProps) {
  const meta = node ? TITLES[node.type] : null;

  return (
    <Sheet open={Boolean(node)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-96 sm:max-w-96">
        {node && meta && (
          <>
            <SheetHeader>
              <SheetTitle>{meta.title}</SheetTitle>
              <SheetDescription>{meta.description}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4">
              <NodeFields
                node={node}
                templates={templates}
                senders={senders}
                categories={categories}
                onConfigChange={onConfigChange}
              />
            </div>

            {node.type !== "trigger" && (
              <SheetFooter>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onRemove(node.id)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Remove step
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NodeFields({
  node,
  templates,
  senders,
  categories,
  onConfigChange,
}: {
  node: AutomationNode;
  templates: { id: string; name: string }[];
  senders: SenderOption[];
  categories: { id: string; name: string }[];
  onConfigChange: (nodeId: string, config: AutomationNodeConfig) => void;
}) {
  switch (node.type) {
    case "trigger": {
      const config = node.config as TriggerConfig;
      return (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>When this happens</FieldLabel>
            <Select
              value={config.event}
              onValueChange={(event) =>
                onConfigChange(node.id, { event: event as TriggerEvent })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENTS.map((trigger) => (
                  <SelectItem key={trigger.event} value={trigger.event}>
                    {trigger.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              {
                TRIGGER_EVENTS.find((trigger) => trigger.event === config.event)
                  ?.description
              }
            </FieldDescription>
          </Field>
        </FieldGroup>
      );
    }

    case "send_email": {
      const config = node.config as SendEmailConfig;
      const patch = (partial: Partial<SendEmailConfig>) =>
        onConfigChange(node.id, { ...config, ...partial });
      return (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>Template</FieldLabel>
            <Select
              value={config.templateId || undefined}
              onValueChange={(templateId) => patch({ templateId })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a saved template" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Your templates</SelectLabel>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <FieldDescription>
                No saved templates yet — save one from the editor first.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>Send from</FieldLabel>
            <Select
              value={config.fromEmail || undefined}
              onValueChange={(fromEmail) => patch({ fromEmail })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a sender" />
              </SelectTrigger>
              <SelectContent>
                {senders.map((sender) => (
                  <SelectItem
                    key={sender.email}
                    value={sender.email}
                    disabled={sender.disabled}
                  >
                    {sender.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="automation-from-name">From name</FieldLabel>
            <Input
              id="automation-from-name"
              value={config.fromName}
              placeholder="Your organization"
              onChange={(event) => patch({ fromName: event.target.value })}
            />
          </Field>
        </FieldGroup>
      );
    }

    case "condition": {
      const config = node.config as ConditionConfig;
      const patch = (partial: Partial<ConditionConfig>) =>
        onConfigChange(node.id, { ...config, ...partial });
      const needsValue =
        CONDITION_OPERATORS.find((op) => op.value === config.operator)?.needsValue ??
        true;
      return (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>Contact field</FieldLabel>
            <Select
              value={config.field}
              onValueChange={(field) => patch({ field: field as ConditionField })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Comparison</FieldLabel>
            <Select
              value={config.operator}
              onValueChange={(operator) =>
                patch({ operator: operator as ConditionOperator })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPERATORS.map((operator) => (
                  <SelectItem key={operator.value} value={operator.value}>
                    {operator.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {needsValue && (
            <Field>
              <FieldLabel htmlFor="automation-condition-value">Value</FieldLabel>
              <Input
                id="automation-condition-value"
                value={config.value}
                placeholder="e.g. @gmail.com"
                onChange={(event) => patch({ value: event.target.value })}
              />
              <FieldDescription>
                Case-insensitive. Contacts that match go down the True branch.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>
      );
    }

    case "delay": {
      const config = node.config as DelayConfig;
      const patch = (partial: Partial<DelayConfig>) =>
        onConfigChange(node.id, { ...config, ...partial });
      return (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="automation-delay-amount">Wait for</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="automation-delay-amount"
                type="number"
                min={1}
                className="w-24"
                value={String(config.amount)}
                onChange={(event) =>
                  patch({ amount: Math.max(1, Number(event.target.value) || 1) })
                }
              />
              <Select
                value={config.unit}
                onValueChange={(unit) => patch({ unit: unit as DelayUnit })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldDescription>
              The flow pauses here for each contact, then continues on its own.
            </FieldDescription>
          </Field>
        </FieldGroup>
      );
    }

    case "update_contact": {
      const config = node.config as UpdateContactConfig;
      return (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="automation-update-name">Set name to</FieldLabel>
            <Input
              id="automation-update-name"
              value={config.name}
              placeholder="New name"
              onChange={(event) =>
                onConfigChange(node.id, { name: event.target.value })
              }
            />
            <FieldDescription>
              Leave empty to keep the contact&apos;s current name.
            </FieldDescription>
          </Field>
        </FieldGroup>
      );
    }

    case "add_category": {
      const config = node.config as AddCategoryConfig;
      return (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>Category</FieldLabel>
            <Select
              value={config.categoryId || undefined}
              onValueChange={(categoryId) =>
                onConfigChange(node.id, { categoryId })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <FieldDescription>
                No categories yet — create one on the Audience page first.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      );
    }

    case "delete_contact":
      return (
        <p className="text-sm text-muted-foreground">
          This step removes the contact from your audience. There is nothing to
          configure — pair it with a condition if it should only apply to some
          contacts.
        </p>
      );
  }
}
