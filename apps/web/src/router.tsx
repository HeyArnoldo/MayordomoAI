import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminRoute, OnboardedRoute, ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/layouts/app-layout';

// Páginas lazy-loaded: cada una es un chunk separado.
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const EsperaPage = lazy(() => import('@/pages/espera'));
const OnboardingPage = lazy(() => import('@/pages/onboarding'));
const HomePage = lazy(() => import('@/pages/home'));
const ChatPage = lazy(() => import('@/pages/chat'));
const TransactionsPage = lazy(() => import('@/pages/transactions'));
const BoxesPage = lazy(() => import('@/pages/boxes'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const AdminPage = lazy(() => import('@/pages/admin'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      // Fuera del layout: pantallas de transición (cada una valida su estado).
      { path: '/espera', element: <EsperaPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <OnboardedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/movimientos', element: <TransactionsPage /> },
              { path: '/chat', element: <ChatPage /> },
              { path: '/cajas', element: <BoxesPage /> },
              { path: '/configuracion', element: <SettingsPage /> },
              // El historial de razonamiento ahora vive dentro de Configuración.
              { path: '/agente', element: <Navigate to="/configuracion" replace /> },
              {
                element: <AdminRoute />,
                children: [{ path: '/admin', element: <AdminPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
]);
