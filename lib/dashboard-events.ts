export const ORGANIZATION_CHANGED_EVENT = "letterstack:organization-changed";

export type OrganizationChangedDetail = {
  organizationId: string;
};

export function dispatchOrganizationChanged(organizationId: string) {
  window.dispatchEvent(
    new CustomEvent<OrganizationChangedDetail>(ORGANIZATION_CHANGED_EVENT, {
      detail: { organizationId },
    }),
  );
}

export function onOrganizationChanged(
  handler: (detail: OrganizationChangedDetail) => void,
) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<OrganizationChangedDetail>).detail);
  };

  window.addEventListener(ORGANIZATION_CHANGED_EVENT, listener);
  return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, listener);
}

// Fired when the audience or its folders change (contact added, folder
// created/renamed/deleted) so other surfaces — notably the sidebar's folder
// list — can refresh without a full reload.
export const AUDIENCE_CHANGED_EVENT = "letterstack:audience-changed";

export function dispatchAudienceChanged() {
  window.dispatchEvent(new CustomEvent(AUDIENCE_CHANGED_EVENT));
}

export function onAudienceChanged(handler: () => void) {
  const listener = () => handler();
  window.addEventListener(AUDIENCE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(AUDIENCE_CHANGED_EVENT, listener);
}