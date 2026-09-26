// Synthetic identities for the disposable CI database. Never production accounts.
export const e2eAccounts = {
  admin: { name: "관리검증", phone: "01000000001", rosterId: "00000000-0000-4000-8000-000000000101", userId: "00000000-0000-4000-8000-000000000201" },
  member: { name: "성도검증", phone: "01000000002", rosterId: "00000000-0000-4000-8000-000000000102", userId: "00000000-0000-4000-8000-000000000202" },
  newcomer: { name: "최초검증", phone: "01000000003", rosterId: "00000000-0000-4000-8000-000000000103", userId: null },
} as const;
export const e2eChallengeId = "00000000-0000-4000-8000-000000000001";
export const e2ePublishedNoticeId = "00000000-0000-4000-8000-000000000301";
export const e2eDraftNoticeId = "00000000-0000-4000-8000-000000000302";
