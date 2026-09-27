import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VisitRequestPanel } from "../../components/visits/VisitRequestPanel";

const boundary = vi.hoisted(() => ({ session: vi.fn(), provider: vi.fn(), submit: vi.fn(), update: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: boundary.session }));
vi.mock("../../src/features/visits/provider-factory", () => ({ getSelectedCalendarProvider: boundary.provider }));
vi.mock("../../src/features/visits/service", () => ({ submitVisitRequest: boundary.submit }));
vi.mock("../../src/features/visits/admin-service", () => ({ updateVisitDetails: boundary.update, deleteVisit: vi.fn(), dbVisitAdminRepository: {} }));
import { POST } from "../../app/api/visits/route";
import { PATCH } from "../../app/api/admin/visits/[id]/route";

const emptyFields = { attendees: "", location: "", preferredTime: "", reason: "" };
const booking = { visitDate: "2099-10-08", visitType: "personal" };
const request = (body: unknown) => new Request("https://example.test/api/visits", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  boundary.session.mockResolvedValue({ id: "member", role: "member" });
  boundary.provider.mockResolvedValue({});
  boundary.submit.mockResolvedValue({ id: "visit" });
});

describe("optional visit details", () => {
  it("offers an enabled 신청 action with no required text inputs", () => {
    const html = renderToStaticMarkup(createElement(VisitRequestPanel, {
      visitDate: booking.visitDate, requesterName: "검증", onClose() {}, onSuccess() {},
    }));
    const submit = html.match(/<button\b(?=[^>]*type="submit")([^>]*)>신청<\/button>/);
    expect(submit).not.toBeNull();
    expect(submit?.[1]).not.toContain("disabled");
    expect(html).not.toMatch(/<(input|textarea)[^>]*\brequired=/);
  });

  it.each([{}, emptyFields, { attendees: "  ", location: "\n", preferredTime: " ", reason: " " }])(
    "accepts missing or blank details and passes normalized strings to booking", async (details) => {
      const response = await POST(request({ ...booking, ...details }));
      expect(response.status).toBe(201);
      expect(boundary.submit).toHaveBeenCalledWith({ ...booking, ...emptyFields, requesterUserId: "member" }, {});
    },
  );

  it("retains field size limits and required date/type validation", async () => {
    for (const input of [{ ...booking, attendees: "가".repeat(3001) }, { ...booking, visitDate: "2099-13-01" }, { visitDate: booking.visitDate }]) {
      expect((await POST(request(input))).status).toBe(400);
    }
    expect(boundary.submit).not.toHaveBeenCalled();
  });

  it("still requires login for an empty-details request", async () => {
    boundary.session.mockResolvedValue(null);
    expect((await POST(request(booking))).status).toBe(401);
    expect(boundary.submit).not.toHaveBeenCalled();
  });

  it("lets an administrator fill one detail while other fields remain blank", async () => {
    boundary.session.mockResolvedValue({ id: "admin", role: "admin" });
    const patch = { ...emptyFields, location: " 교회 " };
    const response = await PATCH(request(patch), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000501" }) });
    expect(response.status).toBe(200);
    expect(boundary.update).toHaveBeenCalledWith(expect.any(String), { ...emptyFields, location: "교회" }, {});
  });
});
