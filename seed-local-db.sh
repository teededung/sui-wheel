#!/bin/bash
set -e

API_URL="http://127.0.0.1:54321/rest/v1"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo "Seeding local database with production data..."

# Import wheels one by one
echo "Importing wheels..."
curl -X POST "$API_URL/wheels" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{"wheel_id":"0x487aa7911a11a355c7635e2eb830644e55af3ab451fd3beb784031a4c43436d7","tx_digest":"2CbJJJQFCeNpdSGpUfpUeaqeM3YiUP4LihX4vYFLuhVy","package_id":"0x75239d71f7fd99bed2619ed7a72f9f29408718f8b6a9f7bdd14339e2efc6ae69","organizer_address":"0xe85415c50fc0032b5c56454ed8e441a309c79058197cba503fcbf616ce7a121c","prizes":[200000000,100000000],"total_donation":300000000,"network":"testnet","coin_type":"0x2::sui::SUI","entries_synced":true}' > /dev/null 2>&1

curl -X POST "$API_URL/wheels" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{"wheel_id":"0xc317c49fd03cf7b6cd92bf65cb9146cda011974265581168495e5db8f6a5dde1","tx_digest":"5RhHwfZEBCvc1F9GJQCgJyVg9LU2vFv8jPZiuF9EgJi9","package_id":"0x75239d71f7fd99bed2619ed7a72f9f29408718f8b6a9f7bdd14339e2efc6ae69","organizer_address":"0xe85415c50fc0032b5c56454ed8e441a309c79058197cba503fcbf616ce7a121c","prizes":[200000000,100000000],"total_donation":300000000,"network":"testnet","coin_type":"0x2::sui::SUI","entries_synced":true}' > /dev/null 2>&1

# Import entries
echo "Importing entries..."
curl -X POST "$API_URL/wheel_entries" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{"wheel_id":"0x487aa7911a11a355c7635e2eb830644e55af3ab451fd3beb784031a4c43436d7","entry_address":"0xe85415c50fc0032b5c56454ed8e441a309c79058197cba503fcbf616ce7a121c","entry_index":3}' > /dev/null 2>&1

curl -X POST "$API_URL/wheel_entries" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{"wheel_id":"0xc317c49fd03cf7b6cd92bf65cb9146cda011974265581168495e5db8f6a5dde1","entry_address":"0xe85415c50fc0032b5c56454ed8e441a309c79058197cba503fcbf616ce7a121c","entry_index":3}' > /dev/null 2>&1

echo "✅ Done! Verifying..."
curl -s "$API_URL/wheel_entries?entry_address=eq.0xe85415c50fc0032b5c56454ed8e441a309c79058197cba503fcbf616ce7a121c&select=wheel_id" \
  -H "apikey: $SERVICE_KEY" | jq
