# WebSocket Queue Management System

This WebSocket server handles various queue management operations for counters and users. It interacts with a MySQL database using Knex.js for querying and performs real-time actions like adding counters, managing user queue numbers, scanning QR codes, and more.

## Features

- **Counter Management:**
  - Add, edit, delete, and change the status of counters.
  
- **User Management:**
  - Fetch all users or a specific user by their unique ID.
  
- **QR Code Management:**
  - Retrieve the QR code associated with a user.

- **Admin Scan:**
  - Handle QR code scanning for admins and generate queue numbers for users based on their device type.

## Requirements

- **Node.js**
- **MySQL Database**
- **Knex.js** for database querying
- **WebSocket** for real-time communication

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Maximum-Ultimate/NPI-server
2. Install the required dependencies:

- npm install
- Set up your MySQL database and configure Knex.js accordingly.

3. Start the WebSocket server:

- node server.js

## Usage
The server listens for WebSocket connections and supports several actions that can be sent by the client in JSON format.


- **Example JSON payload:**
`` {
  "action": "ADD_COUNTER",
  "counter_name": "Counter 1",
  "queues_number": 0,
  "status": "inactive",
  "remarks": ""
}``

## Supported Actions
- **Counter Actions**
ADD_COUNTER

Adds a new counter to the system.
Example payload:
``
{
  "action": "ADD_COUNTER",
  "counter_name": "Counter 1",
  "queues_number": 0,
  "status": "inactive",
  "remarks": ""
}``

EDIT_COUNTER

Edits an existing counter based on its ID.
Example payload:
``
{
  "action": "EDIT_COUNTER",
  "id": 1,
  "counter_name": "Counter 1",
  "queues_number": 10,
  "status": "active",
  "remarks": "Updated"
}``
DELETE_COUNTER

Deletes an existing counter by its ID.
Example payload:
``
{
  "action": "DELETE_COUNTER",
  "id": 1
}``
CHANGE_STATUS

Changes the status of an existing counter.
Example payload:
``
{
  "action": "CHANGE_STATUS",
  "id": 1,
  "status": "active"
}``
User Actions
GET_ALL_USERS

Fetches all users from the system.
No additional parameters required.
GET_USER_BY_UNIQUEID_POST

Fetches a user by their uniqueId using a POST request.
Example payload:
``
{
  "action": "GET_USER_BY_UNIQUEID_POST",
  "uniqueId": "12345"
}``
GET_USER_BY_UNIQUEID_GET

Fetches a user by their uniqueId using a GET request.
Example payload:
``
{
  "action": "GET_USER_BY_UNIQUEID_GET",
  "uniqueId": "12345"
}``
GET_USER_QR

Fetches the QR code associated with a user.
Example payload:
``
{
  "action": "GET_USER_QR",
  "uniqueId": "12345"
}``
Admin Actions
ADMIN_SCAN
Admin scans a user's QR code and assigns them a queue number based on their device type.

Example payload:
``
{
  "action": "ADMIN_SCAN",
  "code": "some-code"
}``
The queue number prefix depends on the user’s device type. Example:

iPhone 15 Pro Max → Prefix: A-
iPhone 15 Pro → Prefix: B-
iPhone 15 Plus → Prefix: A-
iPhone 15 → Prefix: B-
Error Handling
Each action returns a success or error message. If an operation fails (e.g., database errors), the server will return an appropriate error response, such as:
``
{
  "status": "error",
  "message": "Error adding counter"
}``
Error Codes
``
200 - Success
400 - Bad Request (e.g., invalid action or user not found)
404 - Not Found
500 - Server Error``
Example Client
You can connect to the WebSocket server using any WebSocket client library and send the appropriate JSON payloads to interact with the system.

Here’s an example using Node.js:
``
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:PORT_NUMBER');
ws.on('open', function open() {
  ws.send(JSON.stringify({
    action: 'ADD_COUNTER',
    counter_name: 'Counter 1',
    queues_number: 0,
    status: 'inactive',
    remarks: ''
  }));
});
ws.on('message', function incoming(data) {
  console.log(data);
});
``
## Conclusion
This WebSocket server provides real-time queue management for counters and users in a system. The implementation leverages MySQL for persistent data storage and Knex.js for database interactions, making it easy to extend and integrate with other systems.
