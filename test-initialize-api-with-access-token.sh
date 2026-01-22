#!/bin/bash

# Test script for /users/initialize API endpoint using Access Token
# This script tests with the access token which might contain the custom attributes

echo "Testing /users/initialize API endpoint with Access Token..."
echo "=========================================================="

# The access token (might contain custom attributes)
ACCESS_TOKEN="eyJraWQiOiJGc3N2NUM5d3RcL2N3SkJ4VTlVcE96ZXhoOUNQclQ3UEU5VlRlditRWVQ3QT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI5NDI4ODRlOC1lMGExLTcwZjAtYWNlYS1kYjM3MWNjZjM0YWIiLCJjb2duaXRvOmdyb3VwcyI6WyJDbGllbnQiXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfOGprNFZCblRRIiwidmVyc2lvbiI6MiwiY2xpZW50X2lkIjoiMXQxMzRjamYydDA3ZjAxOGNydWZsZzQxcmsiLCJvcmlnaW5fanRpIjoiYTEwZmI5OTYtNTQ4Ni00NTlkLWE5OGQtOWY2NmVmNDA5M2M4IiwiZXZlbnRfaWQiOiJlYTc1OGU5MS1kMDRiLTRiMmQtYTc0ZS1lMjlhNzc4OGM5YzYiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIiwiYXV0aF90aW1lIjoxNzY4OTcyNjQ5LCJleHAiOjE3NjkwNTkwNDksImlhdCI6MTc2ODk3MjY0OSwianRpIjoiMTlkNGRkODItYTc0Ny00Y2U4LTk5NzAtZGE0NjVhYTQxMGVmIiwidXNlcm5hbWUiOiI5NDI4ODRlOC1lMGExLTcwZjAtYWNlYS1kYjM3MWNjZjM0YWIifQ.r09Yeri6lPPZYEfNFZ12NNQAU-dj2ST1fjtP_vfRGRzrJcNwJ6d5LcM2yaK2Eg16O90eEeKPYLe_IHmIq4V5sGkzZKAONZnw7lT7ksU9GOF84_YtlQTltvkgUsljPGIUwwDpEoLX4sCV3kRSITonIQY8xGcxoFmc0SBfatBvKvDvpWaORyMVCjxwMLixv6ZZ0kzlKR4YnP9pGemVUiNSmC6NtR_-1VE7blXso32VzLEqhUm9EKvP-QfK1h8fDuH_k-VfeLSOTjrAQT80E7HzsUpthHFb0zK8kMfe56C2JpACo7JiMDkWyC0GuZK3rPQ5bWauKtjOrrHPLfrrvZnikg"

# API endpoint
API_URL="https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev/users/initialize"

# Test data
USER_TYPE="GYM_OWNER"

echo "Making API request with Access Token..."
echo "Endpoint: $API_URL"
echo "User Type: $USER_TYPE"
echo ""

# Make the API call with access token
curl -i --insecure \
  -X POST "$API_URL" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userType\":\"$USER_TYPE\"}"

echo ""
echo ""
echo "API call completed."
echo "Check the response above for success (200) or any errors."
