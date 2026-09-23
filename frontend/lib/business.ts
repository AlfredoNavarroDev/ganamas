const ACTIVE_BUSINESS_KEY = "ganamas_active_business";

export function getActiveBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_BUSINESS_KEY);
}

export function setActiveBusinessId(businessId: string): void {
  localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
}

export function clearActiveBusinessId(): void {
  localStorage.removeItem(ACTIVE_BUSINESS_KEY);
}
