import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
describe("App", () => {
  it("UI-01: renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("UI-02: shows Online and the seeded categories on success", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ];
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: mockCategories,
    });

    render(<App />);
    const button = screen.getByRole("button", { name: /Check System/i });
    fireEvent.click(button);

    expect(screen.getByText(/Loading…/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Online")).toBeInTheDocument();
    });

    expect(screen.getByText(/Supported Request Categories:/i)).toBeInTheDocument();
    mockCategories.forEach((cat) => {
      expect(screen.getByText(cat.name)).toBeInTheDocument();
    });
  });

  it("UI-03: shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("API is down"));

    render(<App />);
    const button = screen.getByRole("button", { name: /Check System/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Offline \/ Unable to connect to TokTickIT API/i)).toBeInTheDocument();
    });
    
    expect(screen.getByText(/Unable to connect to TokTickIT API/i)).toBeInTheDocument();
    expect(screen.getByText(/API is down/i)).toBeInTheDocument();
  });
});
