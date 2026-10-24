/* oxlint-disable react/only-export-components -- route config module with tiny inline wrappers */
import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { HomeRedirect } from '@/features/auth/RequireRole'
import { AdminLayout, AgentLayout, CustomerLayout } from '@/layouts/RoleLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Pages are code-split: each one downloads the first time its route is visited,
 * so a customer never downloads the admin charts.
 */
function page<M>(importer: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: pick(await importer()) })
}

const settings = page(
  () => import('@/pages/shared/SettingsPage'),
  (m) => m.SettingsPage,
)

const staffTicket = (base: '/agent' | '/admin') =>
  page(
    () => import('@/pages/staff/StaffTicketDetailPage'),
    (m) =>
      function StaffTicket() {
        return <m.StaffTicketDetailPage base={base} />
      },
  )

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/app',
    element: <CustomerLayout />,
    children: [
      {
        index: true,
        lazy: page(
          () => import('@/pages/customer/HomePage'),
          (m) => m.CustomerHomePage,
        ),
      },
      {
        path: 'tickets',
        lazy: page(
          () => import('@/pages/customer/MyTicketsPage'),
          (m) => m.MyTicketsPage,
        ),
      },
      {
        path: 'tickets/:ticketId',
        lazy: page(
          () => import('@/pages/customer/TicketDetailPage'),
          (m) => m.CustomerTicketDetailPage,
        ),
      },
      {
        path: 'new-ticket',
        lazy: page(
          () => import('@/pages/customer/CreateTicketPage'),
          (m) => m.CreateTicketPage,
        ),
      },
      { path: 'settings', lazy: settings },
    ],
  },
  {
    path: '/agent',
    element: <AgentLayout />,
    children: [
      {
        index: true,
        lazy: page(
          () => import('@/pages/agent/DashboardPage'),
          (m) => m.AgentDashboardPage,
        ),
      },
      {
        path: 'tickets',
        lazy: page(
          () => import('@/pages/agent/BoardPage'),
          (m) => m.AgentBoardPage,
        ),
      },
      { path: 'tickets/:ticketId', lazy: staffTicket('/agent') },
      {
        path: 'customers',
        lazy: page(
          () => import('@/pages/staff/PeoplePages'),
          (m) =>
            function AgentCustomers() {
              return <m.CustomersPage canManage={false} />
            },
        ),
      },
      {
        path: 'reports',
        lazy: page(
          () => import('@/pages/agent/ReportsPage'),
          (m) => m.AgentReportsPage,
        ),
      },
      { path: 'settings', lazy: settings },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        lazy: page(
          () => import('@/pages/admin/DashboardPage'),
          (m) => m.AdminDashboardPage,
        ),
      },
      {
        path: 'tickets',
        lazy: page(
          () => import('@/pages/admin/TicketsPage'),
          (m) => m.AdminTicketsPage,
        ),
      },
      { path: 'tickets/:ticketId', lazy: staffTicket('/admin') },
      {
        path: 'customers',
        lazy: page(
          () => import('@/pages/staff/PeoplePages'),
          (m) =>
            function AdminCustomers() {
              return <m.CustomersPage canManage />
            },
        ),
      },
      {
        path: 'agents',
        lazy: page(
          () => import('@/pages/staff/PeoplePages'),
          (m) => m.AgentsPage,
        ),
      },
      {
        path: 'reports',
        lazy: page(
          () => import('@/pages/admin/ReportsPage'),
          (m) => m.AdminReportsPage,
        ),
      },
      { path: 'settings', lazy: settings },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
