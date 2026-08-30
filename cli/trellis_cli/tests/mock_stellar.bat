@echo off
REM Mock stellar CLI binary for Windows CLI integration testing
REM
REM Usage: set TRELLIS_TEST_MODE=true && set STELLAR_MOCK_BIN=tests\mock_stellar.bat && cargo test

if "%1"=="--version" (
    echo stellar 22.0.0 (mock^)
    exit /b 0
)

if "%1"=="contract" if "%2"=="invoke" (
    REM Extract function name from args
    set "FUNC_NAME="
    :parse_args
    if "%~1"=="" goto :done_parsing
    if "%~1"=="--" (
        shift
        set "FUNC_NAME=%~1"
        goto :done_parsing
    )
    shift
    goto :parse_args
    :done_parsing

    if "%FUNC_NAME%"=="init" exit /b 0
    if "%FUNC_NAME%"=="get_agreement" (
        echo {"agreement_id":"0000000000000000000000000000000000000000000000000000000000000001","payer":"GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW","payee":"GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGF","token":"CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ","milestones":[{"id":0,"amount":"1000","status":"Pending","proof_uri":null}],"dispute_resolver":"GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNO","total_amount":"1000"}
        exit /b 0
    )
    if "%FUNC_NAME%"=="lock_funds" exit /b 0
    if "%FUNC_NAME%"=="submit_work" exit /b 0
    if "%FUNC_NAME%"=="approve_and_release" exit /b 0
    if "%FUNC_NAME%"=="raise_dispute" exit /b 0
    if "%FUNC_NAME%"=="resolve_dispute" exit /b 0
    if "%FUNC_NAME%"=="cancel_unfunded_milestone" exit /b 0
    if "%FUNC_NAME%"=="get_total_amount" (
        echo 1000
        exit /b 0
    )

    echo Error: unknown function '%FUNC_NAME%' 1>&2
    exit /b 1
)

echo Error: mock stellar binary received unexpected arguments 1>&2
exit /b 1
