import { IconStack } from "@/components/reui/icon-stack"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InboxIcon, UserPlusIcon, DatabaseIcon } from "lucide-react"

export function Pattern() {
  return (
    <div className="flex items-center justify-center p-4">
      <Empty className="max-w-md py-10">
        <EmptyHeader>
          <EmptyMedia>
            <IconStack aria-hidden="true" className="text-primary h-24 w-22">
              <InboxIcon className="text-primary size-5" />
            </IconStack>
          </EmptyMedia>
          <EmptyTitle>Workspace is ready</EmptyTitle>
          <EmptyDescription>
            Invite teammates or connect a data source to start filling this
            view.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="flex-row justify-center gap-2">
          <Button size="sm">
            <UserPlusIcon data-icon="inline-start" />
            Invite team
          </Button>
          <Button variant="outline" size="sm">
            <DatabaseIcon data-icon="inline-start" />
            Connect source
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}