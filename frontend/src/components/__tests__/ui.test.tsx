import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { Pagination } from "@/components/ui/pagination";
import { QuantityStepper } from "@/components/ui/quantity-stepper";

describe("Stars", () => {
  it("exposes the rating to assistive tech", () => {
    render(<Stars rating={4.5} />);
    expect(screen.getByLabelText("4.5 out of 5 stars")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders the label with the given variant", () => {
    render(<Badge variant="success">Delivered</Badge>);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("hides itself when there is a single page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("emits the neighbouring page", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

function StepperHarness({ max = 10 }: { max?: number }) {
  const [value, setValue] = React.useState(1);
  return <QuantityStepper value={value} max={max} onChange={setValue} />;
}

describe("QuantityStepper", () => {
  it("increments up to the max", async () => {
    const user = userEvent.setup();
    render(<StepperHarness max={3} />);
    const increase = screen.getByRole("button", { name: "Increase quantity" });
    await user.click(increase);
    await user.click(increase);
    await user.click(increase);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(increase).toBeDisabled();
  });

  it("does not go below the minimum", () => {
    render(<StepperHarness />);
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });
});
