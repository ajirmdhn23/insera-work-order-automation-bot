# Testing Report — Insera Work Order Automation Bot

**Test date:** 20 September 2026  
**Environment:** Local development on Windows  
**Bot:** Telegram Bot — Automasi WO Insera  

## Test Summary

| No. | Feature | Test Action | Expected Result | Result |
|---:|---|---|---|---|
| 1 | Application startup | Run `npm start` | Bot starts without errors | Passed |
| 2 | Telegram connection | Start application | Bot connects to Telegram successfully | Passed |
| 3 | Environment configuration | Load `.env` | Required environment variables are loaded | Passed |
| 4 | SQLite database | Start application | Local SQLite data can be loaded | Passed |
| 5 | Insera synchronization | Start application | Data is fetched from Insera API and saved locally | Passed |
| 6 | Scheduled synchronization | Start application | Work Order scheduler runs every 1 hour | Passed |
| 7 | Start command | Send `/start` | Welcome message and registration button appear | Passed |
| 8 | User status validation | Send `/status` before registration | Bot informs user that registration is required | Passed |
| 9 | Registration cancellation | Send `/batal` | Bot cancels the active registration process | Passed |
| 10 | Work Order list | Choose a Service Area | Bot displays Work Order list and navigation controls | Passed |
| 11 | Work Order detail | Send `/wo NOMOR_WO` | Bot displays Work Order details | Passed |

## Startup Test Evidence

The application was started using:

```bash
npm start
```

The application successfully:

- Connected to Telegram Bot API.
- Loaded Work Order cache from SQLite.
- Activated hourly Work Order synchronization.
- Fetched Work Order data from Insera API.
- Stored synchronized data in the local SQLite database.

## Telegram Feature Test Evidence

The following Telegram interactions were tested:

- `/start` displayed the welcome message and registration button.
- `/status` correctly detected an unregistered user.
- `/batal` correctly cancelled the registration flow.
- Work Order list by Service Area was displayed.
- `/wo NOMOR_WO` displayed the selected Work Order detail.

## Security Note

Testing screenshots and public documentation must not expose:

- Telegram bot token.
- Insera credentials, cookies, OTP secrets, or internal URLs.
- Employee identities, phone numbers, NIK, location coordinates, or Telegram IDs.
- Work Order numbers, customer data, owner groups, schedules, and other internal operational data.

The GitHub repository remains private because this project handles internal operational data.