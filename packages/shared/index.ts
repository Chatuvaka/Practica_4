export type AttendanceType =
  | "entrada"
  | "salida";

export type UserRole =
  | "user"
  | "admin";

export interface Profile {
  id: string;
  name: string;
  employeeNumber?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export interface Attendance {
  id: string;
  userId: string;
  type: AttendanceType;
  status: string;
  deviceId?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  active: boolean;
  createdAt: string;
  expiresAt?: string;
}