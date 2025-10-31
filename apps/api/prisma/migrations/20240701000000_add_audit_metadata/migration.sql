-- Add audit log metadata enrichment
ALTER TABLE "audit_logs"
  ADD COLUMN "department_id" UUID,
  ADD COLUMN "primary_entity_type" TEXT,
  ADD COLUMN "primary_entity_id" TEXT,
  ADD COLUMN "affected_entities" JSONB;

CREATE INDEX "audit_logs_department_id_idx" ON "audit_logs"("department_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_department_id_fkey"
  FOREIGN KEY ("department_id")
  REFERENCES "departments"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
