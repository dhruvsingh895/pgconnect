export type Role = 'OWNER' | 'TENANT';
export type ComplaintStatus = 'Open' | 'In progress' | 'Resolved';
export interface Identity {
  id: string;
  role: Role;
  name: string;
  propertyId: string | null;
  demo?: string;
  sessionFamily?: string;
}
export interface Property {
  id: string;
  name: string;
  address: string;
  rooms: number;
  beds: number;
  food: boolean;
  code: string;
  notifications: boolean;
  onlinePayments?: boolean;
}
export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  room: string;
  bed: string;
  moveIn: string;
  rent: number;
  deposit: number;
  documents: string[];
}
export interface Rent {
  id: string;
  tenantId: string;
  month: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  payment?: { status: string; reference: string | null };
}
export interface Complaint {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: ComplaintStatus;
  createdAt: string;
  photo: string | null;
  notes: { text: string; at: string; status: ComplaintStatus }[];
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
  reads: string[];
  image: string | null;
}
export interface MenuDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
}
export interface Notification {
  id: string;
  tenantId: string;
  text: string;
  createdAt: string;
  read: boolean;
}
export interface DashboardData {
  property: Property;
  tenants: Tenant[];
  rents: Rent[];
  complaints: Complaint[];
  announcements: Announcement[];
  menu: MenuDay[];
  notifications: Notification[];
  revision: number;
}
export interface Snapshot {
  user: Identity;
  data: DashboardData;
}
