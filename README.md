 📌 Overview

**PayTrack** is a web-based Employee Attendance and Payroll Management System designed to automate attendance tracking, leave management, and salary calculation.
The system eliminates manual record-keeping, reduces payroll errors, and provides a transparent platform for both employees and administrators.

---
## 🚀 Features

### Admin Module

* Add, update, and manage employee records
* View employee attendance logs
* Approve or reject leave requests
* Generate payroll reports
* Monitor salary records

### Employee Module

* Secure login and authentication
* Mark daily attendance
* Record login and logout times
* Apply for leave
* View attendance history
* Access salary details and payslips

---

## 🛠️ Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Version Control

* Git
* GitHub

---

## 📂 Project Structure

```text
PayTrack/
│
├── frontend/
│   ├── html/
│   ├── css/
│   └── js/
│
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── middleware/
│
├── database/
│
├── screenshots/
│
├── synopsis/
│
├── README.md
│
└── package.json
```

---

## ⚙️ Installation

### Prerequisites

* Node.js
* MongoDB
* Git

### Clone Repository

```bash
git clone https://github.com/your-username/PayTrack.git
cd PayTrack
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### Start Server

```bash
npm start
```

or

```bash
nodemon server.js
```

---

## 📊 Working Methodology

1. User Authentication

   * Secure login for Admin and Employees.

2. Attendance Recording

   * Employees mark attendance through the system.
   * Login and logout timings are stored in the database.

3. Leave Management

   * Employees submit leave requests.
   * Admin approves or rejects requests.

4. Salary Calculation

   * Salary is calculated automatically based on:

     * Working days
     * Approved leaves
     * Deductions
     * Overtime (if applicable)

5. Report Generation

   * Attendance reports
   * Payroll reports
   * Salary slips


## 🎯 Applications

* Small and Medium Enterprises (SMEs)
* Educational Institutions
* Government Offices
* Startups and Freelance Agencies
* Organizations requiring automated payroll processing

---

## 🔮 Future Enhancements

* Biometric Attendance Integration
* GPS/Geofencing Based Attendance
* Mobile Application Support
* Bank API Integration
* Automated Tax & PF Calculation
* Email and SMS Notifications
* Advanced Analytics Dashboard

---

👨‍💻 Author

 Ritik 

Bachelor of Technology
Electronics & Computer Engineering
J.C. Bose University of Science & Technology, YMCA, Faridabad
