#!/bin/sh
set -e

echo "Running database migrations..."
npm run migration:run

echo "Seeding the single app user..."
npm run seed:user

echo "Seeding demo data..."
npm run seed:demo

echo "Starting server..."
exec node dist/src/main
