import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AdminApp } from "./admin/AdminApp.jsx";
import { ToastProvider } from "./hooks/useToast.jsx";
import { ActualizacionDisponible } from "./components/ActualizacionDisponible.jsx";
import "./index.css";

/* Dos aplicaciones en un mismo despliegue: /admin es el panel de oficina
   (ancho, con modo oscuro) y todo lo demás es la app de los agentes (móvil). */
const esAdmin = window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/admin";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {esAdmin ? (
      <AdminApp />
    ) : (
      <ToastProvider>
        <div className="max-w-md mx-auto min-h-screen relative bg-ios-fondo">
          <App />
          <ActualizacionDisponible />
        </div>
      </ToastProvider>
    )}
  </React.StrictMode>
);
