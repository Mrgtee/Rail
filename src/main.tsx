import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { RailProviders } from "./wallet/RailProviders";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RailProviders>
      <App />
    </RailProviders>
  </React.StrictMode>,
);
