# Security Specification for EduAbsen

## Data Invariants
1. A user cannot modify their own role.
2. Students can only read their own QR data or profile.
3. Attendance can only be recorded for valid students.
4. Only Admins can modify the Branding and User database.
5. Only Petugas Scan or Admins can record attendance.

## Dirty Dozen Payloads
1. Student trying to change their role to 'Admin' on their profile.
2. Unauthenticated user trying to read the user list.
3. Student trying to read someone else's attendance record.
4. Student trying to write an attendance record.
5. Malicious user spoofing 'jamMasuk' with a non-server timestamp.
6. Malicious user injecting a 1MB string into the 'nama' field.
7. Petugas trying to delete an old attendance record (only Admin can).
8. Anonymous user attempting to reset the today's attendance.
9. User setting a document ID that is excessively long.
10. Creating an attendance record for a student ID that doesn't exist.
11. Updating 'jamPulang' without a previous 'jamMasuk'.
12. Overwriting the Branding configuration without being an Admin.

## Test Runner (Simplified)
- Verify `PERMISSION_DENIED` for all above cases.
