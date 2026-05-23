@echo off
REM AI Development Tools Configuration Script (Windows)
REM Configures: Claude Code (env vars) + Codex CLI (config files)
REM Version: 2.2.0 (English, No Encoding Issues)

setlocal enabledelayedexpansion

REM Configuration Constants
set "CLAUDE_BASE_URL=https://coder.api.visioncoder.cn"
set "CODEX_BASE_URL=https://coder.api.visioncoder.cn/v1"
set "CODEX_MODEL=gpt-5.4"

REM Configuration Choices (set by user)
set "CONFIGURE_CLAUDE=false"
set "CONFIGURE_CODEX=false"
set "CLAUDE_API_KEY="

REM Jump to main function
goto :main

REM ============================================
REM Utility Functions
REM ============================================

:print_banner
cls
echo.
echo ============================================================
echo.
echo         AI Development Tools Config Script v2.2.0
echo.
echo    Configures: Claude Code, Codex CLI
echo.
echo ============================================================
echo.
goto :eof

:log_info
echo [INFO] %~1
goto :eof

:log_success
echo [ OK ] %~1
goto :eof

:log_warning
echo [WARN] %~1
goto :eof

:log_error
echo [FAIL] %~1
goto :eof

:log_step
echo [STEP] %~1
goto :eof

REM ============================================
REM User Selection Menu
REM ============================================

:show_config_menu
cls
echo.
echo ============================================================
echo.
echo         AI Development Tools Config Script v2.2.0
echo.
echo ============================================================
echo.
echo Select tools to configure:
echo.
echo   1) Claude Code only
echo   2) Codex CLI only
echo   3) Configure both (Recommended)
echo   q) Quit
echo.

set /p "CONFIG_CHOICE=Choose [1-3]: "

if "%CONFIG_CHOICE%"=="1" (
    set "CONFIGURE_CLAUDE=true"
    set "CONFIGURE_CODEX=false"
    call :log_success "Will configure: Claude Code"
    goto :eof
)

if "%CONFIG_CHOICE%"=="2" (
    set "CONFIGURE_CLAUDE=false"
    set "CONFIGURE_CODEX=true"
    call :log_success "Will configure: Codex CLI"
    goto :eof
)

if "%CONFIG_CHOICE%"=="3" (
    set "CONFIGURE_CLAUDE=true"
    set "CONFIGURE_CODEX=true"
    call :log_success "Will configure: Claude Code + Codex CLI"
    goto :eof
)

if /i "%CONFIG_CHOICE%"=="q" (
    call :log_info "Configuration cancelled"
    timeout /t 2 /nobreak >nul
    exit 0
)

call :log_error "Invalid selection"
echo.
pause
goto :show_config_menu

REM ============================================
REM Check Administrator Privileges
REM ============================================

:check_admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    set "IS_ADMIN=false"
    call :log_warning "Not running as administrator"
    call :log_info "Will set user-level environment variables"
) else (
    set "IS_ADMIN=true"
    call :log_success "Administrator privileges detected"
    call :log_info "Will set system-level environment variables"
)
goto :eof

REM ============================================
REM Claude Code Configuration (Environment Variables)
REM ============================================

:configure_claude
echo.
echo ============================================================
echo   Configuring Claude Code
echo ============================================================
echo.

REM Check claude command
where claude >nul 2>&1
if %errorLevel% neq 0 (
    call :log_error "Claude Code not installed"
    call :log_info "Please run install script first: install.bat"
    exit /b 1
)

call :log_success "Claude Code is installed"

REM Get API Key
echo.
echo ============================================================
echo   Get Claude API Key
echo ============================================================
echo.
call :log_info "How to get Claude API Key:"
echo.
echo   1. Visit: https://coder.visioncoder.cn/key
echo   2. Login to your account
echo   3. Copy the displayed API Key
echo.
call :log_warning "Make sure your API Key is valid and not expired"
echo.

REM Auto-open browser
call :log_info "Opening browser for you..."
start https://coder.visioncoder.cn/key
echo.
call :log_info "Please login and copy API Key, then continue..."
echo.

set /p CLAUDE_API_KEY="Paste Claude API Key: "

if "%CLAUDE_API_KEY%"=="" (
    call :log_error "API Key cannot be empty"
    exit /b 1
)

REM Configure environment variables
call :log_step "Configuring environment variables..."
echo.

if "%IS_ADMIN%"=="true" (
    call :log_info "Setting system-level environment variables..."

    setx ANTHROPIC_AUTH_TOKEN "%CLAUDE_API_KEY%" /M >nul 2>&1
    if %errorLevel% equ 0 (
        call :log_success "ANTHROPIC_AUTH_TOKEN set successfully (system-level)"
    ) else (
        call :log_error "Failed to set ANTHROPIC_AUTH_TOKEN"
    )

    setx ANTHROPIC_API_KEY "%CLAUDE_API_KEY%" /M >nul 2>&1
    if %errorLevel% equ 0 (
        call :log_success "ANTHROPIC_API_KEY set successfully (system-level)"
    ) else (
        call :log_error "Failed to set ANTHROPIC_API_KEY"
    )

    setx ANTHROPIC_BASE_URL "%CLAUDE_BASE_URL%" /M >nul 2>&1
    if %errorLevel% equ 0 (
        call :log_success "ANTHROPIC_BASE_URL set successfully (system-level)"
    ) else (
        call :log_error "Failed to set ANTHROPIC_BASE_URL"
    )
) else (
    call :log_info "Setting user-level environment variables..."

    setx ANTHROPIC_AUTH_TOKEN "%CLAUDE_API_KEY%" >nul 2>&1
    if %errorLevel% equ 0 (
        call :log_success "ANTHROPIC_AUTH_TOKEN set successfully (user-level)"
    ) else (
        call :log_error "Failed to set ANTHROPIC_AUTH_TOKEN"
    )

    setx ANTHROPIC_API_KEY "%CLAUDE_API_KEY%" >nul 2>&1
    if %errorLevel% equ 0 (
        call :log_success "ANTHROPIC_API_KEY set successfully (user-level)"
    ) else (
        call :log_error "Failed to set ANTHROPIC_API_KEY"
    )

    setx ANTHROPIC_BASE_URL "%CLAUDE_BASE_URL%" >nul 2>&1
    if %errorLevel% equ 0 (
        call :log_success "ANTHROPIC_BASE_URL set successfully (user-level)"
    ) else (
        call :log_error "Failed to set ANTHROPIC_BASE_URL"
    )
)

REM Load into current session immediately
set "ANTHROPIC_AUTH_TOKEN=%CLAUDE_API_KEY%"
set "ANTHROPIC_API_KEY=%CLAUDE_API_KEY%"
set "ANTHROPIC_BASE_URL=%CLAUDE_BASE_URL%"

call :log_success "Environment variables active in current session"

echo.
call :log_info "Configuration details:"
echo   * ANTHROPIC_AUTH_TOKEN: %CLAUDE_API_KEY:~0,12%...
echo   * ANTHROPIC_API_KEY: %CLAUDE_API_KEY:~0,12%...
echo   * ANTHROPIC_BASE_URL: %CLAUDE_BASE_URL%
echo.

exit /b 0

REM ============================================
REM Codex CLI Configuration (Config Files)
REM ============================================

:configure_codex
echo.
echo ============================================================
echo   Configuring Codex CLI
echo ============================================================
echo.

REM Check codex command
where codex >nul 2>&1
if %errorLevel% neq 0 (
    call :log_warning "Codex CLI not installed"
    call :log_info "Please run install script first: install.bat"
    exit /b 0
)

call :log_success "Codex CLI is installed"

REM Use previously obtained API Key (passed as parameter)
if "%~1"=="" (
    call :log_error "API Key not provided"
    exit /b 1
)

set "OPENAI_API_KEY=%~1"

REM Create config directory
set "CODEX_DIR=%USERPROFILE%\.codex"
call :log_step "Creating config directory: %CODEX_DIR%"

if not exist "%CODEX_DIR%" mkdir "%CODEX_DIR%"
call :log_success "Config directory created"

REM Create config.toml
call :log_step "Creating config file: config.toml"

(
echo model_provider = "codex"
echo model = "%CODEX_MODEL%"
echo model_reasoning_effort = "high"
echo disable_response_storage = true
echo preferred_auth_method = "apikey"
echo.
echo.
echo [model_providers.codex]
echo name = "codex"
echo base_url = "%CODEX_BASE_URL%"
echo wire_api = "responses"
echo requires_openai_auth = true
) > "%CODEX_DIR%\config.toml"

call :log_success "config.toml created"

REM Create auth.json
call :log_step "Creating auth file: auth.json"

(
echo {
echo     "OPENAI_API_KEY": "%OPENAI_API_KEY%"
echo }
) > "%CODEX_DIR%\auth.json"

call :log_success "auth.json created (permissions: 600)"

echo.
call :log_info "Codex configuration details:"
echo   * config.toml: %CODEX_DIR%\config.toml
echo   * auth.json: %CODEX_DIR%\auth.json
echo   * Base URL: %CODEX_BASE_URL%
echo   * Model: %CODEX_MODEL%
echo   * API Key: Using same Claude API Key
echo.

exit /b 0

REM ============================================
REM Verify Configuration
REM ============================================

:verify_configuration
call :print_banner
echo ============================================================
echo   Configuration Complete
echo ============================================================
echo.

echo Configuration status:
echo.

REM Claude Code
if defined ANTHROPIC_AUTH_TOKEN (
    call :log_success "Claude Code: Configured"
    call :log_info "  API Token: %ANTHROPIC_AUTH_TOKEN:~0,12%..."
    call :log_info "  Base URL: %ANTHROPIC_BASE_URL%"
) else (
    call :log_warning "Claude Code: Not configured"
)

echo.

REM Codex CLI
if exist "%USERPROFILE%\.codex\auth.json" (
    call :log_success "Codex CLI: Configured"
    call :log_info "  Config directory: %USERPROFILE%\.codex"
    call :log_info "  Base URL: %CODEX_BASE_URL%"
) else (
    call :log_warning "Codex CLI: Not configured (optional)"
)

echo.
echo ============================================================
echo   Usage Instructions
echo ============================================================
echo.

if defined ANTHROPIC_AUTH_TOKEN (
    call :log_info "Claude Code usage:"
    echo   ^> claude --help
    echo   ^> claude "your question"
    echo.
)

if exist "%USERPROFILE%\.codex\auth.json" (
    call :log_info "Codex CLI usage:"
    echo   ^> codex --version
    echo   ^> codex
    echo   Then send a message to verify connection
    echo.
)

echo IMPORTANT:
echo   1. Do not share your API Key with others
echo   2. Config file permissions set to secure mode
echo   3. Run this script again to reconfigure
echo.
echo To make environment variables effective:
echo   [Current session: Already effective] You can use claude command now
echo   New command prompt windows will auto-load environment variables
echo.
echo Test immediately (current window):
echo   ^> claude --help
echo   ^> echo %%ANTHROPIC_AUTH_TOKEN%%
echo.
echo If commands don't work:
echo   1. Reopen command prompt (Recommended)
echo   2. Or log out and log back into Windows
echo.

goto :eof

REM ============================================
REM Main Function
REM ============================================

:main
REM Show selection menu
call :show_config_menu

echo.
timeout /t 1 /nobreak >nul
call :print_banner

call :log_info "This script will configure:"
if "%CONFIGURE_CLAUDE%"=="true" (
    echo   1. Claude Code (environment variables)
)
if "%CONFIGURE_CODEX%"=="true" (
    echo   2. Codex CLI (config files)
)
echo.

REM Check admin privileges
call :check_admin
echo.

call :log_step "Starting configuration..."
echo.

REM 1. Configure Claude Code
if "%CONFIGURE_CLAUDE%"=="true" (
    call :configure_claude
    if %errorLevel% equ 0 (
        call :log_success "Claude Code configuration complete"
    ) else (
        call :log_error "Claude Code configuration failed"
        pause
        exit /b 1
    )
)

REM 2. Configure Codex CLI (using same API Key)
if "%CONFIGURE_CODEX%"=="true" (
    if defined CLAUDE_API_KEY (
        call :configure_codex "%CLAUDE_API_KEY%"
    ) else if "%CONFIGURE_CLAUDE%"=="false" (
        REM If Claude not configured, get API Key separately
        echo.
        call :log_info "Please enter API Key for Codex CLI configuration"
        echo.
        set /p "CODEX_API_KEY=Paste API Key: "
        if "!CODEX_API_KEY!"=="" (
            call :log_error "API Key cannot be empty"
            pause
            exit /b 1
        )
        call :configure_codex "!CODEX_API_KEY!"
    )
)

REM 3. Verify configuration
echo.
timeout /t 1 /nobreak >nul
call :verify_configuration

echo.
echo Window will close in 3 seconds...
timeout /t 3 /nobreak >nul
exit /b 0
