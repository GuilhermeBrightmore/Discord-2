import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { error?: Error };

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha ao renderizar o aplicativo", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return <div className="crash-screen"><div><AlertTriangle /><h1>O aplicativo encontrou um erro</h1><p>{this.state.error.message || "Nao foi possivel exibir esta tela."}</p><button className="primary-button" onClick={() => window.location.reload()}><RefreshCw /> Recarregar aplicativo</button></div></div>;
  }
}
