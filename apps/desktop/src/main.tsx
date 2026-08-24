import React from "react";
import ReactDOM from "react-dom/client";
import "@livekit/components-styles";
import "./styles.css";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);
