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