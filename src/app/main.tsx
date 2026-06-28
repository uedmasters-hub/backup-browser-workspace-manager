import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../index.css";

import App from "./App";
import PopupErrorBoundary from "./PopupErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PopupErrorBoundary>
      <App />
    </PopupErrorBoundary>
  </StrictMode>
);
