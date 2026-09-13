# Smot - Event Inventory Tracking System

A web application for tracking event inventory with admin and member views.

## Features

- **Admin Panel**: Create events with inventory items, view all reports
- **Member View**: Submit inventory reports after events, see discrepancies
- **Firebase Integration**: Real-time data storage

## Setup Instructions

### 1. Firebase Configuration
The Firebase config is already set up in `js/firebase-config.js`. You need to:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `smot-dolab-w-elshanta`
3. Enable **Authentication** > **Sign-in method** > **Email/Password**
4. Create 3 admin users in **Authentication** > **Users**

### 2. Firestore Database
1. Go to **Firestore Database** in Firebase Console
2. Create database in **test mode** (for development)
3. The app will automatically create the `events` and `reports` collections

### 3. Hosting (Optional)
To host the website:
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Deploy: `firebase deploy`

Or simply open `index.html` in a browser for local testing.

## How to Use

### Admin
1. Go to `index.html`
2. Login with your admin credentials
3. Create events with name, date, and items
4. View all member reports

### Member
1. Go to `member.html`
2. See all events
3. Click "Submit Report" for an event
4. Enter actual quantities
5. See ✓ for matches, ✗ for discrepancies
6. Add reasons for discrepancies

## File Structure
```
/
├── index.html          # Admin login page
├── admin.html          # Admin dashboard
├── member.html         # Member view
├── css/
│   └── style.css       # Styles
├── js/
│   ├── firebase-config.js  # Firebase configuration
│   ├── login.js        # Admin login logic
│   ├── admin.js        # Admin dashboard logic
│   └── member.js       # Member view logic
└── README.md           # This file