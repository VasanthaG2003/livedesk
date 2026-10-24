import { ChartColumn, House, LayoutDashboard, Settings, Ticket, UserCog, Users } from 'lucide-react'
import type { NavItem } from '@/components/layout/types'

export const customerNav: NavItem[] = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/tickets', label: 'My Tickets', icon: Ticket },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export const agentNav: NavItem[] = [
  { to: '/agent', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/agent/tickets', label: 'Tickets', icon: Ticket },
  { to: '/agent/customers', label: 'Customers', icon: Users },
  { to: '/agent/reports', label: 'Reports', icon: ChartColumn },
  { to: '/agent/settings', label: 'Settings', icon: Settings },
]

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/agents', label: 'Agents', icon: UserCog },
  { to: '/admin/reports', label: 'Reports', icon: ChartColumn },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]
