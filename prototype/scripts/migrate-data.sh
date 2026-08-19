#!/bin/bash
# One-shot data migration to Supabase via docker exec psql.
# Reads /c/tmp/hitopia_inserts.sql (created from local pg_dump --column-inserts)
# and pipes it into Supabase's psql client.
# Adds SET session_replication_role = 'replica' to bypass FK constraints during bulk insert.

set -e

SQL_FILE="/c/tmp/hitopia_inserts.sql"
SUPABASE_URL="postgresql://postgres.vtynjoolyodqacqotzye:hAIz2RHe8Qkgzr1X@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Check file exists
if [ ! -f "$SQL_FILE" ]; then
  echo "ERROR: $SQL_FILE not found"
  exit 1
fi

# Use a temp container to run psql with the Supabase connection.
# We use postgres:16 image to match the schema.
echo "Setting up psql container..."
docker pull postgres:16 > /dev/null 2>&1 || true

# Run psql with the dump
echo "Pushing data to Supabase ($SQL_FILE)..."

# Prepend the SET command to disable FK
(echo "SET session_replication_role = 'replica';"; cat "$SQL_FILE") | \
docker run -i --rm postgres:16 \
  psql "$SUPABASE_URL" \
  -v ON_ERROR_STOP=1 \
  --set sslmode=require \
  --set sslcert=/dev/null \
  -c "SELECT 'Connection OK'" 2>&1 | tail -50

echo "--- checking row counts ---"
docker run -i --rm postgres:16 \
  psql "$SUPABASE_URL" \
  --set sslmode=require \
  -c "SELECT 'talent' AS t, COUNT(*) FROM talent
      UNION ALL SELECT 'delivery_record', COUNT(*) FROM delivery_record
      UNION ALL SELECT 'performance_score', COUNT(*) FROM performance_score
      UNION ALL SELECT 'app_user', COUNT(*) FROM app_user
      UNION ALL SELECT 'scoring_config', COUNT(*) FROM scoring_config
      UNION ALL SELECT 'source_setting', COUNT(*) FROM source_setting
      UNION ALL SELECT 'delivery_ticket', COUNT(*) FROM delivery_ticket
      UNION ALL SELECT 'ingestion_run', COUNT(*) FROM ingestion_run
      UNION ALL SELECT 'identity_mapping', COUNT(*) FROM identity_mapping
      UNION ALL SELECT 'project', COUNT(*) FROM project
      UNION ALL SELECT 'cost_rate', COUNT(*) FROM cost_rate" 2>&1 | tail -20
