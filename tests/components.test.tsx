// @vitest-environment jsdom
import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReservationCard, Empty } from "../components/quickdine";
import type { Booking } from "../domain/types";
afterEach(cleanup);
const booking: Booking = {
  id: "QD-TEST",
  restaurantId: "l-essence",
  restaurantName: "L’Essence",
  image: "/images/restaurant_5.webp",
  date: "2026-12-01",
  time: "19:00",
  guests: 2,
  occasion: "Birthday",
  requests: "A quiet table, please",
  status: "pending",
  name: "Alex",
  email: "alex@example.com",
  createdAt: 0,
};
it("renders the full reservation with its special request", () => {
  render(<ReservationCard booking={booking} onChange={() => {}} />);
  expect(screen.getByText("L’Essence")).toBeVisible();
  expect(screen.getByText("Note: A quiet table, please")).toBeVisible();
  expect(screen.getByText("pending")).toBeVisible();
});
it("lets diners cancel without exposing a confirmation action", () => {
  const change = vi.fn();
  render(<ReservationCard booking={booking} onChange={change} />);
  expect(
    screen.queryByRole("button", { name: /confirm reservation/i }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /cancel reservation/i }));
  expect(change).toHaveBeenCalledWith("QD-TEST", "cancelled");
});
it("allows management to confirm incoming requests", () => {
  const change = vi.fn();
  render(<ReservationCard booking={booking} manager onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: /confirm reservation/i }));
  expect(change).toHaveBeenCalledWith("QD-TEST", "confirmed");
});
it("removes actions for cancelled reservations", () => {
  render(
    <ReservationCard
      booking={{ ...booking, status: "cancelled" }}
      onChange={() => {}}
      manager
    />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("provides meaningful empty states", () => {
  render(
    <Empty title="No reservations yet">
      <p>Your next evening awaits.</p>
    </Empty>,
  );
  expect(
    screen.getByRole("heading", { name: "No reservations yet" }),
  ).toBeVisible();
  expect(screen.getByText("Your next evening awaits.")).toBeVisible();
});
