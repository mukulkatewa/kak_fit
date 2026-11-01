[CmdletBinding()]
param(
    [switch]$Build,
    [string]$Device,
    [string]$ApiUrl = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$apkPath = Join-Path $projectRoot 'results/kak-fit-emulator.apk'
$adb = (Get-Command adb.exe -ErrorAction Stop).Source

if (-not $Device) {
    $emulators = @(& $adb devices | Where-Object { $_ -match '^(emulator-\d+)\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if ($emulators.Count -ne 1) {
        throw 'Start one Android emulator, or pass -Device emulator-5554 to select it.'
    }
    $Device = $emulators[0]
}
if ((& $adb -s $Device shell getprop sys.boot_completed).Trim() -ne '1') {
    throw "Emulator $Device has not finished booting."
}
& $adb -s $Device reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) { throw 'Could not connect the emulator to the local API.' }

if ($Build) {
    if (-not (Test-Path (Join-Path $projectRoot 'node_modules/expo/package.json'))) {
        throw 'Install project dependencies with pnpm install --frozen-lockfile first.'
    }
    if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
        throw 'ANDROID_HOME must point to the installed Android SDK.'
    }
    if (-not $ApiUrl) { throw 'Pass -ApiUrl with the backend URL.' }
    $architecture = (& $adb -s $Device shell getprop ro.product.cpu.abi).Trim()
    if ($architecture -notin @('x86_64', 'arm64-v8a', 'x86', 'armeabi-v7a')) {
        throw "Unsupported emulator architecture: $architecture"
    }

    $previousApiUrl = $env:EXPO_PUBLIC_API_URL
    $previousCi = $env:CI
    $previousNodeEnv = $env:NODE_ENV
    $previousMetroRoot = $env:EXPO_NO_METRO_WORKSPACE_ROOT
    try {
        $env:EXPO_PUBLIC_API_URL = $ApiUrl
        $env:CI = '1'
        $env:NODE_ENV = 'production'
        # Expo's Windows release bundler must resolve index.js from apps/mobile.
        $env:EXPO_NO_METRO_WORKSPACE_ROOT = '1'
        $sdkPath = $env:ANDROID_HOME.Replace('\', '/')
        Set-Content (Join-Path $projectRoot 'apps/mobile/android/local.properties') "sdk.dir=$sdkPath" -Encoding ASCII
        Push-Location (Join-Path $projectRoot 'apps/mobile/android')
        try {
            Write-Host "Building Kak Fit for $architecture using $ApiUrl"
            & .\gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=$architecture" '--init-script' (Join-Path $PSScriptRoot 'android-emulator.init.gradle') '--max-workers=2' '--no-parallel' '--no-daemon' '-Pkotlin.compiler.execution.strategy=in-process' '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=1024m' '--console=plain'
            if ($LASTEXITCODE -ne 0) { throw "Android build failed (exit $LASTEXITCODE)." }
        } finally { Pop-Location }
        New-Item (Split-Path $apkPath -Parent) -ItemType Directory -Force | Out-Null
        Copy-Item (Join-Path $projectRoot 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk') $apkPath -Force
    } finally {
        $env:EXPO_PUBLIC_API_URL = $previousApiUrl
        $env:CI = $previousCi
        $env:NODE_ENV = $previousNodeEnv
        $env:EXPO_NO_METRO_WORKSPACE_ROOT = $previousMetroRoot
    }
    if (-not (Test-Path $apkPath)) { throw 'The build did not produce an APK.' }
    & $adb -s $Device install -r $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'APK installation failed.' }
}

$installed = & $adb -s $Device shell pm path app.kakfit.mobile
if ($LASTEXITCODE -ne 0 -or -not $installed) {
    throw 'Kak Fit is not installed. Run this script with -Build first.'
}
& $adb -s $Device shell am start -n app.kakfit.mobile/.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'Could not launch Kak Fit.' }
Write-Host 'Kak Fit is open in the emulator. This standalone APK does not need Metro.'
