import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { LoadingScreen } from "./components/LoadingScreen";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { TransactionFormPage } from "./pages/TransactionFormPage";
import { TransactionsPage } from "./pages/TransactionsPage";

function AppRoutes() {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={status === "authenticated" ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      <Route
        element={status === "authenticated" ? <AppLayout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/new" element={<TransactionFormPage mode="create" />} />
        <Route
          path="/transactions/:transactionId/edit"
          element={<TransactionFormPage mode="edit" />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to={status === "authenticated" ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
