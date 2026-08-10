import assert from "node:assert/strict";
import test from "node:test";
import {
  createTimingTicket,
  getVisibleTicketComment,
} from "./ticketEntry.ts";

const baseTicket = {
  id: "ticket-1",
  code: "T11",
  sorteo: "TIEMPOS (COMODIN)",
  amount: 1500,
  time: "10:30:00",
};

test("T11 Mixed tickets persist a trimmed optional comment", () => {
  assert.deepEqual(
    createTimingTicket({
      ...baseTicket,
      timingMode: "mixto",
      comment: "  Pago pendiente  ",
    }),
    { ...baseTicket, comment: "Pago pendiente" },
  );
});

test("T11 Mixed tickets omit empty comments", () => {
  const ticket = createTimingTicket({
    ...baseTicket,
    timingMode: "mixto",
    comment: "   ",
  });

  assert.equal("comment" in ticket, false);
});

test("comments are ignored outside T11 Mixed entry", () => {
  assert.equal(
    "comment" in
      createTimingTicket({
        ...baseTicket,
        timingMode: "individual",
        comment: "No guardar",
      }),
    false,
  );
  assert.equal(
    "comment" in
      createTimingTicket({
        ...baseTicket,
        code: "T10",
        timingMode: "mixto",
        comment: "No guardar",
      }),
    false,
  );
});

test("ticket card comments support old and blank ticket values", () => {
  assert.equal(getVisibleTicketComment(undefined), null);
  assert.equal(getVisibleTicketComment("   "), null);
  assert.equal(getVisibleTicketComment("  Entregado  "), "Entregado");
});
