@echo off
REM Hang mock: simulates a stellar binary that stalls indefinitely.
REM
REM Used by the timeout unit tests in rpc.rs to verify that invoke_once
REM returns within STELLAR_INVOKE_TIMEOUT_SECS rather than blocking forever.
REM
REM `timeout /t` aborts immediately when stdin is redirected (and may resolve
REM to GNU timeout from Git's usr\bin), so ping localhost to wait instead.

ping -n 9999 127.0.0.1 >nul
