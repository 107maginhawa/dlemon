CREATE UNIQUE INDEX "dental_appointment_no_double_book_idx" ON "dental_appointment" USING btree ("dentist_member_id","scheduled_at") WHERE status NOT IN ('cancelled', 'no_show');
