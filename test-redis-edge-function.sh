#!/bin/bash

echo "Testing Redis Edge Function Connection"
echo "======================================="
echo ""
echo "This script will test if your Edge Function can access Redis."
echo "You need your Supabase anon key to run this test."
echo ""
echo "1. Get your anon key from:"
echo "   https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb/settings/api"
echo ""
echo "2. Run this command with your device ID and anon key:"
echo ""
echo "curl -X POST https://ierdfxgeectqoekugyvb.supabase.co/functions/v1/get-device-qr \\"
echo "  -H \"Authorization: Bearer YOUR_ANON_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"deviceId\": \"95b82521-db89-451f-8543-2300cfab4eca\"}'"
echo ""
echo "Expected successful response:"
echo '{'
echo '  "qrCode": null,'
echo '  "pairingCode": "1WFH8JAZ",'
echo '  "deviceId": "95b82521-db89-451f-8543-2300cfab4eca"'
echo '}'
echo ""
echo "If you get 'Redis not configured' error, you need to add the credentials to Supabase Vault."