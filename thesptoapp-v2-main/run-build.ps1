$env:NODE_OPTIONS = "--require c:\Users\emman\OneDrive\Documents\thesptoapp-v2-main\dns-fix.js"
Set-Location $PSScriptRoot
Write-Host "Building from: $(Get-Location)"
Write-Host "app.json slug: $((Get-Content ./app.json | ConvertFrom-Json).expo.slug)"
Write-Host "package.json main: $((Get-Content ./package.json | ConvertFrom-Json).main)"
& npx eas-cli build --platform ios --profile production --non-interactive
