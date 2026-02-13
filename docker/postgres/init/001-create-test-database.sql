SELECT 'CREATE DATABASE pennywise_test'
WHERE NOT EXISTS (
  SELECT
  FROM pg_database
  WHERE datname = 'pennywise_test'
)\gexec
