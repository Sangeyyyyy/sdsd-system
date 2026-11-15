/** JSON shapes shared by the public API routes and client components. */

export type PublicAppointment = {
  id: number;
  studentNo: string;
  fullName: string;
  program: string;
  campus: string;
  date: string;
  queueNumber: number;
  status: string;
  referenceCode: string;
  bookedAt: string;
  verifiedAt: string | null;
};

export type LookupStudent = {
  studentNo: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  fullName: string;
  program: string;
  campus: string;
};

export type LookupState = {
  status: "new" | "booked" | "verified" | "blocked";
  message: string;
  canBook: boolean;
  noShowCount: number;
  maxRebooks: number;
  nextAvailableDate: string | null;
  active: PublicAppointment | null;
  verifiedAppointment: PublicAppointment | null;
};

export type LookupResponse = {
  student: LookupStudent;
  state: LookupState;
};

export type ApiError = {
  error: string;
  message: string;
};

export type BookResponse =
  | { ok: true; appointment: PublicAppointment; alreadyBooked: boolean }
  | { ok: false; code: string; message: string };
