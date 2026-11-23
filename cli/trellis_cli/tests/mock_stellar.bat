@echo off
REM Mock stellar CLI binary for Windows CLI integration testing
REM
REM Usage: set TRELLIS_TEST_MODE=true && set STELLAR_MOCK_BIN=tests\mock_stellar.bat && cargo test
REM
REM Kept as flat goto-based code: labels inside a parenthesized block break
REM cmd's parser, and variables set in a block are expanded before it runs.

if "%~1"=="--version" goto :version
if not "%~1"=="contract" goto :unexpected
if not "%~2"=="invoke" goto :unexpected

REM Extract function name: the first argument after "--"
set "FUNC_NAME="

:parse_args
if "%~1"=="" goto :dispatch
if "%~1"=="--" goto :found_separator
shift
goto :parse_args

:found_separator
shift
set "FUNC_NAME=%~1"

:dispatch
if "%FUNC_NAME%"=="init" exit /b 0
if "%FUNC_NAME%"=="get_agreement" goto :get_agreement
if "%FUNC_NAME%"=="get_milestone" goto :get_milestone
if "%FUNC_NAME%"=="lock_funds" exit /b 0
if "%FUNC_NAME%"=="submit_work" exit /b 0
if "%FUNC_NAME%"=="approve_and_release" exit /b 0
if "%FUNC_NAME%"=="raise_dispute" exit /b 0
if "%FUNC_NAME%"=="resolve_dispute" exit /b 0
if "%FUNC_NAME%"=="cancel_unfunded_milestone" exit /b 0
if "%FUNC_NAME%"=="get_total_amount" goto :get_total_amount

echo Error: unknown function '%FUNC_NAME%' 1>&2
exit /b 1

:get_agreement
echo {"agreement_id":"0000000000000000000000000000000000000000000000000000000000000001","payer":"GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW","payee":"GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGF","token":"CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ","milestones":[{"id":0,"amount":"1000","status":"Pending","proof_uri":null}],"dispute_resolver":"GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNO","total_amount":"1000"}
exit /b 0

:get_milestone
echo {"id":0,"amount":"1000","status":"Pending","proof_uri":null}
exit /b 0

:get_total_amount
echo 1000
exit /b 0

:version
echo stellar 26.0.0 (mock)
exit /b 0

:unexpected
echo Error: mock stellar binary received unexpected arguments 1>&2
exit /b 1
