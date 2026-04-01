import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { LoadingScreen } from "./components/LoadingScreen";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { TransactionFormPage } from "./pages/TransactionFormPage";
import { TransactionsPage } from "./pages/TransactionsPage";

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return status === "authenticated" ? <Navigate to="/dashboard" replace /> : children;
}

function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return status === "authenticated" ? <AppLayout /> : <Navigate to="/login" replace />;
}

function AppFallbackRoute() {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return <Navigate to={status === "authenticated" ? "/dashboard" : "/login"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/new" element={<TransactionFormPage mode="create" />} />
        <Route
          path="/transactions/:transactionId/edit"
          element={<TransactionFormPage mode="edit" />}
        />
      </Route>

      <Route path="*" element={<AppFallbackRoute />} />
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
