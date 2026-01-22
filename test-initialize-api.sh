#!/bin/bash

# Test script for /users/initialize API endpoint
# This script tests the corrected curl command with proper JWT token format

echo "Testing /users/initialize API endpoint..."
echo "========================================="

# The corrected JWT token (ID token only)
TOKEN="eyJraWQiOiJTalBFcnBST3F0WWEyQXN0Mm1rcXNXOUdZRFVjOGNIYjR2UE40cDBRQVpjPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiOUVfSnZEaFh1VkpZd0hrUjFlaUZmZyIsInN1YiI6Ijk0Mjg4NGU4LWUwYTEtNzBmMC1hY2VhLWRiMzcxY2NmMzRhYiIsImNvZ25pdG86Z3JvdXBzIjpbIkNsaWVudCJdLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfOGprNFZCblRRIiwiY29nbml0bzp1c2VybmFtZSI6Ijk0Mjg4NGU4LWUwYTEtNzBmMC1hY2VhLWRiMzcxY2NmMzRhYiIsImdpdmVuX25hbWUiOiJKdWxpbyIsIm9yaWdpbl9qdGkiOiJhMTBmYjk5Ni01NDg2LTQ1OWQtYTk4ZC05ZjY2ZWY0MDkzYzgiLCJhdWQiOiIxdDEzNGNqZjJ0MDdmMDE4Y3J1ZmxnNDFyayIsImV2ZW50X2lkIjoiZWE3NThlOTEtZDA0Yi00YjJkLWE3NGUtZTI5YTc3ODhjOWM2IiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE3Njg5NzI2NDksImV4cCI6MTc2OTA1OTA0OSwiaWF0IjoxNzY4OTcyNjQ5LCJmYW1pbHlfbmFtZSI6Ikd1dGllcnJleiBNb3JhbGVzIiwianRpIjoiN2MzMzlkNmQtZWNmMy00MzZkLTk0MmItNTkzZmIxMDZiOWU4IiwiZW1haWwiOiJqdWxpb2d1dGllcnJlenRyYWRlckBnbWFpbC5jb20ifQ.eIvJ7Ofzth2PHOvoHboOQpn9X-gXND2EXZHyQnYWcQ285E3AJLD45e1iCmA2kX8NT9a8bM1B6pstQqK2X9gUU4ePhHLPOsFvgfByiDeI5kFYk75E2A-SOYveVU1kHLsf99kBnAa_12mJFgLIeMw4SsPJOQRDOctFJpyS0cRNzHb7B3XDgZFpsvAU5ITIKv03x2_12fGBXh7q0OnY2bDRfgUldnLS_h08xZLTOZ6WEmV_Au4nvJ6iZ5zbk2u80Ud-G_x0teUmuF0cA-TM9Bg6NcuwYU0bnpaKyW0U9OJu6Joo6ZiOM5ZwcCmxNPNBR3X11lrRVMG-j1RkSQoAMldn9g"

# API endpoint
API_URL="https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev/users/initialize"

# Test data
USER_TYPE="GYM_OWNER"

echo "Making API request..."
echo "Endpoint: $API_URL"
echo "User Type: $USER_TYPE"
echo ""

# Make the API call
curl -i \
  -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userType\":\"$USER_TYPE\"}"

echo ""
echo ""
echo "API call completed."
echo "Check the response above for success (200) or any errors."
