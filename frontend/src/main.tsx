import React from "react";
import ReactDOM from "react-dom/client";
import "antd/dist/reset.css";

import App from "./App";
import "./styles.css";
import "./console-theme.css";
import "./workbench-theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
