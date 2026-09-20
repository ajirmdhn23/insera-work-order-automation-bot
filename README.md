# Insera Work Order Automation Bot

Telegram-based automation system for employee registration, location capture, Work Order monitoring, and scheduled data synchronization for Insera operations.

## Overview

This project is a Telegram bot developed to support Work Order monitoring and employee registration workflows. The bot provides a centralized interface for users to register, share their location, view Work Order reports by Service Area, and access Work Order details.

The system is designed for internal operational use and integrates with Insera configuration through environment variables.

## Features

- Employee registration through Telegram
- Validation of employee identity, work unit, and phone number
- Optional location sharing with Google Maps link generation
- User profile recap and registration data management
- Delete registration data through a confirmation flow
- Work Order report by Service Area
- Work Order pagination with a maximum of 10 records per page
- Navigation between Service Areas without chat message stacking
- Work Order detail lookup using `/wo NOMOR_WO`
- Scheduled Work Order data synchronization
- Bot status command
- Secure environment variable configuration

## Service Areas

The bot supports the following Service Areas:

- SA Batu
- SA Bululawang
- SA Klojen
- SA Kepanjen
- SA Turen
- SA Malang
- SA Sawojajar
- SA Blitar
- SA Tulungagung

## Available Commands

| Command | Description |
|---|---|
| `/start` | Start the bot or open the main menu |
| `/wo NOMOR_WO` | View Work Order detail by Work Order number |
| `/status` | Check bot status |
| `/batal` | Cancel an active registration process |

## Project Structure

```text
insera-work-order-automation-bot/
├── config/       # Application and Insera configuration
├── data/         # Work Order source data
├── database/     # Database connection and repositories
├── handlers/     # Telegram bot handlers
├── jobs/         # Scheduled synchronization and reminder jobs
├── scripts/      # Test scripts
├── services/     # Business logic and API services
├── storage/      # Local database files (excluded from Git)
├── utils/        # Utility helpers
├── .env.example  # Environment variable template
├── .gitignore    # Git ignore rules
├── index.js      # Application entry point
└── package.json  # Project dependencies and scripts
```

## Requirements

- Node.js 18 or later
- npm
- Telegram Bot Token
- Insera API configuration and authorized credentials

## Installation

1. Clone the repository:

```bash
git clone [https://github.com/ajirmdhn23/insera-work-order-automation-bot.git](https://github.com/ajirmdhn23/insera-work-order-automation-bot.git)
```

2. Open the project directory:

```bash
cd insera-work-order-automation-bot
```

3. Install dependencies:

```bash
npm install
```

4. Create the environment file:

```bash
copy .env.example .env
```

5. Fill in the required environment variables in `.env`.

6. Start the bot:

```bash
npm start
```

## Environment Variables

Create a `.env` file based on `.env.example`.

```env
TELEGRAM_BOT_TOKEN=ISI_TOKEN_BOT_TELEGRAM_DI_SINI

INSERA_BASE_URL=ISI_BASE_URL_INSERA_DI_SINI
INSERA_LOGIN_URL=ISI_LOGIN_URL_INSERA_DI_SINI
INSERA_USERNAME=ISI_USERNAME_INSERA_DI_SINI
INSERA_PASSWORD=ISI_PASSWORD_INSERA_DI_SINI
INSERA_OTP_SECRET=ISI_OTP_SECRET_INSERA_DI_SINI
```

Never commit the `.env` file because it contains private credentials.

## Security Notes

- The `.env` file is excluded from Git.
- The `storage/` directory is excluded from Git because it may contain local database files and user data.
- The `node_modules/` directory is excluded from Git because dependencies can be restored with `npm install`.
- This repository is configured as private because it is intended for internal operational use.

## Deployment

For continuous operation, deploy the bot to a cloud server or VPS and run it using a process manager such as PM2.

Example:

```bash
pm2 start index.js --name insera-work-order-bot
pm2 save
pm2 startup
```

## Developer

Developed by **Gadang Aji Ramadhan**  
Internship Project — Telkom Indonesia / Telkom Akses Karangploso