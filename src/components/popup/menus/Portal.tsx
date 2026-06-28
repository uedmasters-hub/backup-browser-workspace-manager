import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Portal({ children }: Props) {
  return createPortal(children, document.body);
}
