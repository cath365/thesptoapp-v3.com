#!/bin/bash
# Fix directory permissions for EAS build
echo "Fixing directory permissions..."
chmod -R u+rwx .
echo "Permissions fixed."

# Regenerate lockfile with the build server's npm version
# (local npm 11 lockfile is incompatible with build server's npm 10)
echo "Regenerating package-lock.json with server npm..."
rm -f package-lock.json
npm install --legacy-peer-deps
echo "Pre-install complete."
